use serde::Deserialize;
use serde_json::json;
use worker::{console_log, D1Database, Env, Fetch, Headers, Method, Request, RequestInit};

use crate::util::{now_secs, random_uuid, sha256_hex};

pub const VERIFY: &str = "verify";
pub const RESET: &str = "reset";
pub const VERIFY_SECS: i64 = 24 * 60 * 60;
pub const RESET_SECS: i64 = 60 * 60;
const RESEND_SECS: i64 = 2 * 60;

pub fn app_url(env: &Env) -> worker::Result<String> {
    Ok(env
        .var("APP_URL")?
        .to_string()
        .trim_end_matches('/')
        .to_string())
}

pub async fn create_token(
    db: &D1Database,
    user_id: u32,
    purpose: &str,
    valid_secs: i64,
) -> worker::Result<Option<String>> {
    let now = now_secs();

    #[derive(Deserialize)]
    struct LastRow {
        last: Option<f64>,
    }
    let last: Option<LastRow> = db
        .prepare(
            "SELECT MAX(created_at) AS last FROM email_tokens WHERE user_id = ?1 AND purpose = ?2",
        )
        .bind(&[user_id.into(), purpose.into()])?
        .first(None)
        .await?;
    if let Some(last) = last.and_then(|r| r.last) {
        if now - (last as i64) < RESEND_SECS {
            return Ok(None);
        }
    }

    db.prepare("DELETE FROM email_tokens WHERE expires_at < ?1")
        .bind(&[(now as f64).into()])?
        .run()
        .await?;

    let token = format!("{}{}", random_uuid()?, random_uuid()?).replace('-', "");
    db.prepare(
        "INSERT INTO email_tokens (token_hash, user_id, purpose, created_at, expires_at) \
         VALUES (?1, ?2, ?3, ?4, ?5)",
    )
    .bind(&[
        sha256_hex(&token).into(),
        user_id.into(),
        purpose.into(),
        (now as f64).into(),
        ((now + valid_secs) as f64).into(),
    ])?
    .run()
    .await?;
    Ok(Some(token))
}

pub async fn consume_token(
    db: &D1Database,
    token: &str,
    purpose: &str,
) -> worker::Result<Option<u32>> {
    if token.len() != 64 || !token.chars().all(|c| c.is_ascii_hexdigit()) {
        return Ok(None);
    }

    #[derive(Deserialize)]
    struct UserRow {
        user_id: u32,
    }
    let row: Option<UserRow> = db
        .prepare(
            "DELETE FROM email_tokens WHERE token_hash = ?1 AND purpose = ?2 AND expires_at > ?3 \
             RETURNING user_id",
        )
        .bind(&[
            sha256_hex(token).into(),
            purpose.into(),
            (now_secs() as f64).into(),
        ])?
        .first(None)
        .await?;
    Ok(row.map(|r| r.user_id))
}

pub async fn send_verification(env: &Env, to: &str, token: &str) -> worker::Result<()> {
    let link = format!("{}/verify-email?token={token}", app_url(env)?);
    let text = format!(
        "Welcome to PinTheCity!\n\nConfirm your email address by opening this link:\n{link}\n\n\
         The link works for 24 hours. If you didn't create an account, you can ignore this email."
    );
    let html = layout(
        "Confirm your email",
        "Welcome to PinTheCity! Confirm your email address so you can always get back into your account.",
        &link,
        "Confirm email",
        "The link works for 24 hours. If you didn't create an account, you can ignore this email.",
    );
    send(env, to, "Confirm your PinTheCity email", &text, &html).await
}

pub async fn send_password_reset(env: &Env, to: &str, token: &str) -> worker::Result<()> {
    let link = format!("{}/reset-password?token={token}", app_url(env)?);
    let text = format!(
        "Someone asked to reset the password for your PinTheCity account.\n\n\
         Choose a new password here:\n{link}\n\n\
         The link works for 1 hour. If it wasn't you, ignore this email and your password stays the same."
    );
    let html = layout(
        "Reset your password",
        "Someone asked to reset the password for your PinTheCity account.",
        &link,
        "Choose a new password",
        "The link works for 1 hour. If it wasn't you, ignore this email and your password stays the same.",
    );
    send(env, to, "Reset your PinTheCity password", &text, &html).await
}

fn layout(title: &str, intro: &str, link: &str, button: &str, footer: &str) -> String {
    format!(
        r#"<!doctype html><html><body style="margin:0;padding:24px;background:#f1f3f9;font-family:system-ui,sans-serif;color:#0d1330">
<div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:28px">
<h1 style="margin:0 0 12px;font-size:22px">{title}</h1>
<p style="margin:0 0 20px;line-height:1.5">{intro}</p>
<p style="margin:0 0 20px"><a href="{link}" style="display:inline-block;padding:12px 20px;border-radius:999px;background:#499a13;color:#0b1a05;font-weight:700;text-decoration:none">{button}</a></p>
<p style="margin:0 0 8px;font-size:13px;color:#545d7c;line-height:1.5">{footer}</p>
<p style="margin:0;font-size:12px;color:#545d7c;word-break:break-all">{link}</p>
</div></body></html>"#
    )
}

async fn send(env: &Env, to: &str, subject: &str, text: &str, html: &str) -> worker::Result<()> {
    let Ok(key) = env.secret("RESEND_API_KEY") else {
        if app_url(env)?.starts_with("http://localhost") {
            console_log!("--- email to {to}: {subject}\n{text}\n---");
            return Ok(());
        }
        return Err(worker::Error::RustError(
            "RESEND_API_KEY is not set".to_string(),
        ));
    };

    let body = json!({
        "from": env.var("EMAIL_FROM")?.to_string(),
        "to": [to],
        "subject": subject,
        "text": text,
        "html": html,
    });
    let headers = Headers::new();
    headers.set("Authorization", &format!("Bearer {key}"))?;
    headers.set("Content-Type", "application/json")?;
    let mut init = RequestInit::new();
    init.with_method(Method::Post)
        .with_headers(headers)
        .with_body(Some(body.to_string().into()));

    let request = Request::new_with_init("https://api.resend.com/emails", &init)?;
    let mut response = Fetch::Request(request).send().await?;
    if !(200..300).contains(&response.status_code()) {
        let detail = response.text().await.unwrap_or_default();
        return Err(worker::Error::RustError(format!(
            "resend returned {}: {detail}",
            response.status_code()
        )));
    }
    Ok(())
}
