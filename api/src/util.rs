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

pub fn is_valid_email(email: &str) -> bool {
    if email.len() > 254 || email.chars().any(|c| c.is_whitespace() || c.is_control()) {
        return false;
    }
    let Some((local, domain)) = email.split_once('@') else {
        return false;
    };
    !local.is_empty()
        && local.len() <= 64
        && !domain.contains('@')
        && domain.contains('.')
        && domain.split('.').all(|part| !part.is_empty())
}

pub fn client_ip(headers: &HeaderMap) -> &str {
    headers
        .get("cf-connecting-ip")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown")
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_normal_emails() {
        for email in ["a@b.co", "first.last@example.com", "x+tag@mail.example.org"] {
            assert!(is_valid_email(email), "{email} should be valid");
        }
    }

    #[test]
    fn rejects_broken_emails() {
        for email in [
            "", "@", "a@", "@b.co", "a@b", "a@@b.co", "a@b@c.co", "a@.co", "a@b.", "a@b..co",
            "a b@c.co", "a@b .co",
        ] {
            assert!(!is_valid_email(email), "{email:?} should be invalid");
        }
    }

    #[test]
    fn rejects_too_long_emails() {
        let local = "a".repeat(65);
        assert!(!is_valid_email(&format!("{local}@b.co")));
        let domain = "b".repeat(250);
        assert!(!is_valid_email(&format!("a@{domain}.co")));
    }
}
