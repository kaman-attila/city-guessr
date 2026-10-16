use axum::http::HeaderMap;
use sha2::{Digest, Sha256};

pub fn random_uuid() -> worker::Result<String> {
    let crypto = js_sys::Reflect::get(&js_sys::global(), &"crypto".into())?;
    let func = js_sys::Function::from(js_sys::Reflect::get(&crypto, &"randomUUID".into())?);
    func.call0(&crypto)?
        .as_string()
        .ok_or_else(|| worker::Error::RustError("randomUUID returned no string".to_string()))
}

pub fn to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

pub fn sha256_hex(s: &str) -> String {
    to_hex(&Sha256::digest(s.as_bytes()))
}

pub fn now_secs() -> i64 {
    (js_sys::Date::now() / 1000.0) as i64
}

pub fn read_cookie(headers: &HeaderMap, name: &str) -> Option<String> {
    let prefix = format!("{name}=");
    headers
        .get("cookie")?
        .to_str()
        .ok()?
        .split(';')
        .map(|part| part.trim())
        .find_map(|part| part.strip_prefix(prefix.as_str()))
        .map(|value| value.to_string())
}
