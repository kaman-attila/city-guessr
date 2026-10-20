use serde::Deserialize;
use worker::D1Database;

use crate::util::{now_secs, sha256_hex};

pub struct Limit {
    name: &'static str,
    max: u32,
    window_secs: i64,
}

const QUARTER_HOUR: i64 = 15 * 60;

pub const LOGIN_PER_EMAIL: Limit = Limit { name: "login-email", max: 10, window_secs: QUARTER_HOUR };
pub const LOGIN_PER_IP: Limit = Limit { name: "login-ip", max: 20, window_secs: QUARTER_HOUR };
pub const REGISTER_PER_IP: Limit = Limit { name: "register-ip", max: 10, window_secs: 60 * 60 };
pub const FORGOT_PER_IP: Limit = Limit { name: "forgot-ip", max: 5, window_secs: QUARTER_HOUR };
pub const RESET_PER_IP: Limit = Limit { name: "reset-ip", max: 10, window_secs: QUARTER_HOUR };
pub const DELETE_PER_USER: Limit = Limit { name: "delete-user", max: 10, window_secs: QUARTER_HOUR };

pub const KEEP_SECS: i64 = 24 * 60 * 60;

pub async fn allow(db: &D1Database, limit: &Limit, subject: &str, secret: &str) -> worker::Result<bool> {
    let key = sha256_hex(&format!("{secret}:{}:{subject}", limit.name));
    let now = now_secs();

    #[derive(Deserialize)]
    struct CountRow {
        count: u32,
    }

    let row: Option<CountRow> = db
        .prepare(
            "INSERT INTO auth_attempts (key, window_start, count) VALUES (?1, ?2, 1) \
             ON CONFLICT (key) DO UPDATE SET \
               count = CASE WHEN window_start <= ?3 THEN 1 ELSE count + 1 END, \
               window_start = CASE WHEN window_start <= ?3 THEN ?2 ELSE window_start END \
             RETURNING count",
        )
        .bind(&[
            key.as_str().into(),
            (now as f64).into(),
            ((now - limit.window_secs) as f64).into(),
        ])?
        .first(None)
        .await?;
    Ok(row.is_none_or(|r| r.count <= limit.max))
}
