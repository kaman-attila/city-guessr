use axum::http::HeaderMap;
use sha2::{Digest, Sha256};
use crate::util::{random_uuid, to_hex};

pub fn read_guest_id(headers: &HeaderMap) -> Option<String> {
    let value = headers.get("cookie")?.to_str().ok()?;

    let id = value
        .split(';')
        .map(|part| part.trim())
        .find_map(|part| part.strip_prefix("guest_id="))?;

    let valid = id.len() == 36
        && id
            .chars()
            .all(|char| char.is_ascii_hexdigit() || char == '-');
    if valid {
        Some(id.to_string())
    } else {
        None
    }
}

fn guest_cookie(id: &str) -> String {
    format!("guest_id={id}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax")
}

pub fn get_or_create_guest(headers: &HeaderMap) -> worker::Result<(String, Option<String>)> {
    match read_guest_id(headers) {
        Some(id) => Ok((id, None)),
        None => {
            let id = random_uuid()?;
            let cookie = guest_cookie(&id);
            Ok((id, Some(cookie)))
        }
    }
}

pub fn ip_hash(headers: &HeaderMap, secret: &str, date: &str) -> String {
    let ip = headers
        .get("cf-connecting-ip")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown");
    let hash = Sha256::digest(format!("{secret}:{date}:{ip}"));
    to_hex(&hash)
}
