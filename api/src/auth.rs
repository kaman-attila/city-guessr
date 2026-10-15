use js_sys::{Array, Function, Object, Promise, Reflect, Uint8Array};
use crate::wasm_bindgen::JsValue;
use wasm_bindgen_futures::JsFuture;

use crate::util::{random_uuid, to_hex};

const ITERATIONS: u32 = 100_000;

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
    Ok(constant_time_eq(to_hex(&hash).as_bytes(), parts[3].as_bytes()))
}

fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}