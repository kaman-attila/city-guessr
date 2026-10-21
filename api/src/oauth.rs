use serde::Deserialize;
use sha2::{Digest, Sha256};
use worker::{Env, Fetch, Headers, Method, Request, RequestInit};

use crate::email::app_url;
use crate::util::{base64_url, form_encode, random_token};

pub const GOOGLE: &str = "google";
const AUTH_URL: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
const USERINFO_URL: &str = "https://openidconnect.googleapis.com/v1/userinfo";
pub const COOKIE: &str = "oauth";
const COOKIE_SECS: u32 = 10 * 60;

pub struct Login {
    pub redirect_url: String,
    pub cookie: String,
}

pub struct Pending {
    pub state: String,
    pub verifier: String,
    pub return_to: String,
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
}

#[derive(Deserialize)]
pub struct GoogleUser {
    pub sub: String,
    pub email: Option<String>,
    #[serde(default)]
    pub email_verified: bool,
}

fn client_id(env: &Env) -> Option<String> {
    let id = env.var("GOOGLE_CLIENT_ID").ok()?.to_string();
    (!id.is_empty()).then_some(id)
}

pub fn is_configured(env: &Env) -> bool {
    client_id(env).is_some() && env.secret("GOOGLE_CLIENT_SECRET").is_ok()
}

fn redirect_uri(env: &Env) -> worker::Result<String> {
    Ok(format!("{}/api/auth/google/callback", app_url(env)?))
}

pub fn safe_return_path(path: Option<&str>) -> String {
    match path {
        Some(p)
            if p.starts_with('/')
                && !p.starts_with("//")
                && p.len() <= 64
                && p.bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b"/-_".contains(&b)) =>
        {
            p.to_string()
        }
        _ => "/".to_string(),
    }
}

pub fn start(env: &Env, return_to: &str) -> worker::Result<Login> {
    let client_id = client_id(env)
        .ok_or_else(|| worker::Error::RustError("GOOGLE_CLIENT_ID is not set".to_string()))?;
    let state = random_token()?;
    let verifier = random_token()?;
    let challenge = base64_url(&Sha256::digest(verifier.as_bytes()));
    let redirect_uri = redirect_uri(env)?;

    let query = form_encode(&[
        ("client_id", &client_id),
        ("redirect_uri", &redirect_uri),
        ("response_type", "code"),
        ("scope", "openid email"),
        ("state", &state),
        ("code_challenge", &challenge),
        ("code_challenge_method", "S256"),
        ("prompt", "select_account"),
    ]);

    Ok(Login {
        redirect_url: format!("{AUTH_URL}?{query}"),
        cookie: format!(
            "{COOKIE}={state}.{verifier}.{return_to}; Path=/api/auth; Max-Age={COOKIE_SECS}; \
             HttpOnly; Secure; SameSite=Lax"
        ),
    })
}

pub fn clear_cookie() -> String {
    format!("{COOKIE}=; Path=/api/auth; Max-Age=0; HttpOnly; Secure; SameSite=Lax")
}

pub fn read_pending(cookie: Option<String>) -> Option<Pending> {
    let cookie = cookie?;
    let mut parts = cookie.splitn(3, '.');
    let state = parts.next()?.to_string();
    let verifier = parts.next()?.to_string();
    let return_to = safe_return_path(parts.next());
    let well_formed = |s: &str| s.len() == 64 && s.chars().all(|c| c.is_ascii_hexdigit());
    (well_formed(&state) && well_formed(&verifier)).then_some(Pending {
        state,
        verifier,
        return_to,
    })
}

pub async fn fetch_google_user(
    env: &Env,
    code: &str,
    verifier: &str,
) -> worker::Result<GoogleUser> {
    let client_id = client_id(env)
        .ok_or_else(|| worker::Error::RustError("GOOGLE_CLIENT_ID is not set".to_string()))?;
    let secret = env.secret("GOOGLE_CLIENT_SECRET")?.to_string();
    let redirect_uri = redirect_uri(env)?;

    let body = form_encode(&[
        ("code", code),
        ("client_id", &client_id),
        ("client_secret", &secret),
        ("redirect_uri", &redirect_uri),
        ("grant_type", "authorization_code"),
        ("code_verifier", verifier),
    ]);
    let headers = Headers::new();
    headers.set("Content-Type", "application/x-www-form-urlencoded")?;
    headers.set("Accept", "application/json")?;
    let mut init = RequestInit::new();
    init.with_method(Method::Post)
        .with_headers(headers)
        .with_body(Some(body.into()));
    let mut response = Fetch::Request(Request::new_with_init(TOKEN_URL, &init)?)
        .send()
        .await?;
    if response.status_code() != 200 {
        let detail = response.text().await.unwrap_or_default();
        return Err(worker::Error::RustError(format!(
            "google token exchange returned {}: {detail}",
            response.status_code()
        )));
    }
    let token: TokenResponse = response.json().await?;

    let headers = Headers::new();
    headers.set("Authorization", &format!("Bearer {}", token.access_token))?;
    let mut init = RequestInit::new();
    init.with_method(Method::Get).with_headers(headers);
    let mut response = Fetch::Request(Request::new_with_init(USERINFO_URL, &init)?)
        .send()
        .await?;
    if response.status_code() != 200 {
        return Err(worker::Error::RustError(format!(
            "google userinfo returned {}",
            response.status_code()
        )));
    }
    response.json().await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_plain_site_paths_are_returned_to() {
        assert_eq!(safe_return_path(Some("/archive")), "/archive");
        assert_eq!(safe_return_path(Some("/")), "/");
        for bad in [
            "//evil.com",
            "https://evil.com",
            "archive",
            "/a?b=c",
            "/a.b",
            "/a\\b",
            "",
        ] {
            assert_eq!(safe_return_path(Some(bad)), "/", "{bad:?}");
        }
        assert_eq!(safe_return_path(None), "/");
    }

    #[test]
    fn pending_cookie_round_trips() {
        let state = "a".repeat(64);
        let verifier = "b".repeat(64);
        let pending = read_pending(Some(format!("{state}.{verifier}./archive"))).unwrap();
        assert_eq!(pending.state, state);
        assert_eq!(pending.verifier, verifier);
        assert_eq!(pending.return_to, "/archive");
    }

    #[test]
    fn broken_pending_cookies_are_ignored() {
        assert!(read_pending(None).is_none());
        assert!(read_pending(Some("short.short./".to_string())).is_none());
        assert!(read_pending(Some("a".repeat(64))).is_none());
    }
}
