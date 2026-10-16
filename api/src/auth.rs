use crate::util::{now_secs, random_uuid, read_cookie, sha256_hex, to_hex};
use crate::wasm_bindgen::JsValue;
use axum::http::HeaderMap;
use js_sys::{Array, Function, Object, Promise, Reflect, Uint8Array};
use serde::Deserialize;
use wasm_bindgen_futures::JsFuture;
use worker::D1Database;

const ITERATIONS: u32 = 100_000;
const SESSION_SECS: i64 = 30 * 24 * 60 * 60;
pub const DUMMY_HASH: &str = "pbkdf2$100000$00000000-0000-0000-0000-000000000000$\
0000000000000000000000000000000000000000000000000000000000000000";

pub async fn create_session(db: &D1Database, user_id: u32) -> worker::Result<String> {
    let token = format!("{}{}", random_uuid()?, random_uuid()?).replace('-', "");
    let expires_at = now_secs() + SESSION_SECS;

    db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?1, ?2, ?3)")
        .bind(&[
            sha256_hex(&token).into(),
            user_id.into(),
            (expires_at as f64).into(),
        ])?
        .run()
        .await?;

    Ok(format!(
        "session={token}; Path=/; Max-Age={SESSION_SECS}; HttpOnly; Secure; SameSite=Lax"
    ))
}

async fn pbkdf2(password: &str, salt: &str, iterations: u32) -> worker::Result<Vec<u8>> {
    let crypto = Reflect::get(&js_sys::global(), &"crypto".into())?;
    let subtle = Reflect::get(&crypto, &"subtle".into())?;

    let usages = Array::new();
    usages.push(&"deriveBits".into());
    let args = Array::new();
    args.push(&"raw".into());
    args.push(&Uint8Array::from(password.as_bytes()));
    args.push(&"PBKDF2".into());
    args.push(&JsValue::FALSE);
    args.push(&usages);
    let import_key = Function::from(Reflect::get(&subtle, &"importKey".into())?);
    let key = JsFuture::from(Promise::from(import_key.apply(&subtle, &args)?)).await?;

    let params = Object::new();
    Reflect::set(&params, &"name".into(), &"PBKDF2".into())?;
    Reflect::set(&params, &"hash".into(), &"SHA-256".into())?;
    Reflect::set(&params, &"salt".into(), &Uint8Array::from(salt.as_bytes()))?;
    Reflect::set(&params, &"iterations".into(), &iterations.into())?;
    let derive_bits = Function::from(Reflect::get(&subtle, &"deriveBits".into())?);
    let promise = derive_bits.call3(&subtle, &params, &key, &256.into())?;
    let bits = JsFuture::from(Promise::from(promise)).await?;

    Ok(Uint8Array::new(&bits).to_vec())
}

pub async fn hash_password(password: &str) -> worker::Result<String> {
    let salt = random_uuid()?;
    let hash = pbkdf2(password, &salt, ITERATIONS).await?;
    Ok(format!("pbkdf2${ITERATIONS}${salt}${}", to_hex(&hash)))
}

pub async fn verify_password(password: &str, stored: &str) -> worker::Result<bool> {
    let parts: Vec<&str> = stored.split('$').collect();
    if parts.len() != 4 || parts[0] != "pbkdf2" {
        return Ok(false);
    }

    let Ok(iterations) = parts[1].parse::<u32>() else {
        return Ok(false);
    };

    let hash = pbkdf2(password, parts[2], iterations).await?;
    Ok(constant_time_eq(
        to_hex(&hash).as_bytes(),
        parts[3].as_bytes(),
    ))
}

pub async fn current_user_id(db: &D1Database, headers: &HeaderMap) -> worker::Result<Option<u32>> {
    let Some(token) = read_cookie(headers, "session") else {
        return Ok(None);
    };
    if token.len() != 64 || !token.chars().all(|c| c.is_ascii_hexdigit()) {
        return Ok(None);
    }

    #[derive(Deserialize)]
    struct Row {
        user_id: u32,
    }
    let row: Option<Row> = db
        .prepare("SELECT user_id FROM sessions WHERE token_hash = ?1 AND expires_at > ?2")
        .bind(&[sha256_hex(&token).into(), (now_secs() as f64).into()])?
        .first(None)
        .await?;
    Ok(row.map(|r| r.user_id))
}

fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}
