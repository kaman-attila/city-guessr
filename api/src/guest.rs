use crate::util::{client_ip, random_uuid, read_cookie, sha256_hex};
use axum::http::HeaderMap;

pub fn read_guest_id(headers: &HeaderMap) -> Option<String> {
    let id = read_cookie(headers, "guest_id")?;
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
    sha256_hex(&format!("{secret}:{date}:{}", client_ip(headers)))
}
