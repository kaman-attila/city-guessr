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

pub fn base64_url(bytes: &[u8]) -> String {
    const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let mut out = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for chunk in bytes.chunks(3) {
        let n = chunk
            .iter()
            .enumerate()
            .fold(0u32, |acc, (i, &b)| acc | (b as u32) << (16 - 8 * i));
        for i in 0..=chunk.len() {
            out.push(ALPHABET[(n >> (18 - 6 * i) & 63) as usize] as char);
        }
    }
    out
}

pub fn percent_encode(s: &str) -> String {
    s.bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                (b as char).to_string()
            }
            _ => format!("%{b:02X}"),
        })
        .collect()
}

pub fn form_encode(pairs: &[(&str, &str)]) -> String {
    pairs
        .iter()
        .map(|(k, v)| format!("{}={}", percent_encode(k), percent_encode(v)))
        .collect::<Vec<_>>()
        .join("&")
}

pub fn random_token() -> worker::Result<String> {
    Ok(format!("{}{}", random_uuid()?, random_uuid()?).replace('-', ""))
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
    fn base64_url_matches_known_values() {
        assert_eq!(base64_url(b""), "");
        assert_eq!(base64_url(b"f"), "Zg");
        assert_eq!(base64_url(b"fo"), "Zm8");
        assert_eq!(base64_url(b"foo"), "Zm9v");
        assert_eq!(base64_url(b"foob"), "Zm9vYg");
        assert_eq!(base64_url(&[0xfb, 0xff, 0xfe]), "-__-");
    }

    #[test]
    fn pkce_challenge_matches_the_rfc_example() {
        let verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
        assert_eq!(
            base64_url(&Sha256::digest(verifier.as_bytes())),
            "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
        );
    }

    #[test]
    fn form_encoding_escapes_reserved_characters() {
        assert_eq!(
            form_encode(&[
                ("redirect_uri", "https://a.b/c?d=e"),
                ("scope", "openid email")
            ]),
            "redirect_uri=https%3A%2F%2Fa.b%2Fc%3Fd%3De&scope=openid%20email"
        );
    }

    #[test]
    fn rejects_too_long_emails() {
        let local = "a".repeat(65);
        assert!(!is_valid_email(&format!("{local}@b.co")));
        let domain = "b".repeat(250);
        assert!(!is_valid_email(&format!("a@{domain}.co")));
    }
}
