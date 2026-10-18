use axum::{
    extract::Path,
    http::{header::SET_COOKIE, HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, patch, post},
    Extension, Json, Router,
};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tower_service::Service;
use wasm_bindgen::JsValue;
use worker::*;

mod auth;
mod email;
mod game;
mod guest;
mod util;

const GUEST_LIMIT_PER_IP: u32 = 3;
const FREEPLAY_GAME_SECS: i64 = 24 * 60 * 60;

enum AppError {
    BadRequest(&'static str),
    NotFound(&'static str),
    Conflict(&'static str),
    Unauthorized(&'static str),
    TooManyRequests(&'static str),
    Internal(String),
}

type ApiResult<T> = std::result::Result<Json<T>, AppError>;

impl IntoResponse for AppError {
    fn into_response(self) -> axum::response::Response {
        let (status, message) = match self {
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg),
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, msg),
            AppError::Conflict(msg) => (StatusCode::CONFLICT, msg),
            AppError::Unauthorized(msg) => (StatusCode::UNAUTHORIZED, msg),
            AppError::TooManyRequests(msg) => (StatusCode::TOO_MANY_REQUESTS, msg),
            AppError::Internal(details) => {
                console_error!("internal error: {details}");
                (StatusCode::INTERNAL_SERVER_ERROR, "something went wrong")
            }
        };
        (status, Json(json!({ "error": message }))).into_response()
    }
}

impl From<worker::Error> for AppError {
    fn from(e: worker::Error) -> Self {
        AppError::Internal(e.to_string())
    }
}

enum Player {
    User(u32),
    Guest(String),
}

impl Player {
    fn key(&self) -> String {
        match self {
            Player::User(id) => format!("u:{id}"),
            Player::Guest(id) => format!("g:{id}"),
        }
    }
}

#[derive(Deserialize)]
struct NameRow {
    id: u32,
    name: String,
    first_city: u32,
    city_count: u32,
}

#[derive(Serialize, Deserialize)]
struct CityRow {
    name: String,
    country: String,
    lat: f64,
    lon: f64,
}

#[derive(Serialize)]
struct GuessResponse {
    distance_m: f64,
    score: u32,
    closest: usize,
    cities: Vec<CityRow>,
}

#[derive(Serialize)]
struct NextRound {
    round: u32,
    name: String,
}

#[derive(Serialize)]
struct PlayedRound {
    name: String,
    score: Option<u32>,
}

#[derive(Serialize)]
struct DailyState {
    date: String,
    total: u32,
    history: Vec<PlayedRound>,
    next: Option<NextRound>,
}

#[derive(Deserialize)]
struct PlayRow {
    round: u32,
    score: u32,
}

#[derive(Deserialize)]
struct PlayHistoryRow {
    round: u32,
    score: u32,
    scores: String,
}

#[derive(Deserialize)]
struct DailyGuessRequest {
    date: String,
    lat: f64,
    lon: f64,
}

#[derive(Serialize)]
struct RoundGuessResponse {
    result: GuessResponse,
    total: u32,
    next: Option<NextRound>,
}

#[derive(Deserialize)]
struct FreeplayRow {
    round: u32,
    name_id: Option<u32>,
}

#[derive(Serialize)]
struct FreeplayStart {
    game_id: String,
    next: NextRound,
}

#[derive(Deserialize)]
struct FreeplayGuessRequest {
    game_id: String,
    lat: f64,
    lon: f64,
}

#[derive(Deserialize)]
struct CountRow {
    n: u32,
}

#[derive(Deserialize)]
struct BucketRow {
    bucket: u32,
    count: u32,
}

#[derive(Serialize)]
struct HistogramResponse {
    date: String,
    your_bucket: Option<u32>,
    bucket_starts: Vec<u32>,
    counts: Vec<u32>,
    players: u32,
    your_score: Option<u32>,
    better_than_percent: Option<u32>,
}

#[derive(Deserialize)]
struct Credentials {
    email: String,
    password: String,
}

#[derive(Deserialize)]
struct IdRow {
    id: u32,
}

#[derive(Deserialize)]
struct LoginRow {
    id: u32,
    pw_hash: String,
}

#[derive(Serialize)]
struct Profile {
    email: String,
    email_verified: bool,
    best_score: u32,
    theme: String,
    units: String,
}

#[derive(Deserialize)]
struct ProfileRow {
    email: String,
    verified: u32,
    best_score: u32,
    theme: String,
    units: String,
}

#[derive(Deserialize)]
struct TokenRequest {
    token: String,
}

#[derive(Deserialize)]
struct EmailRequest {
    email: String,
}

#[derive(Deserialize)]
struct ResetRequest {
    token: String,
    password: String,
}

#[derive(Deserialize)]
struct EmailRow {
    email: String,
}

#[derive(Deserialize)]
struct SettingsRequest {
    theme: Option<String>,
    units: Option<String>,
}

fn router(env: Env) -> Router {
    Router::new()
        .route("/api/health", get(health))
        .route("/api/freeplay", post(freeplay_start))
        .route("/api/freeplay/guess", post(freeplay_guess))
        .route("/api/daily", post(daily_start))
        .route("/api/daily/guess", post(daily_guess))
        .route("/api/daily/histogram/{date}", get(daily_histogram))
        .route("/api/register", post(register))
        .route("/api/login", post(login))
        .route("/api/logout", post(logout))
        .route("/api/me", get(me))
        .route("/api/me/settings", patch(update_settings))
        .route("/api/me/verification-email", post(resend_verification))
        .route("/api/verify-email", post(verify_email))
        .route("/api/forgot-password", post(forgot_password))
        .route("/api/reset-password", post(reset_password))
        .layer(Extension(env))
}

#[event(fetch)]
async fn fetch(
    req: HttpRequest,
    env: Env,
    _ctx: Context,
) -> Result<axum::http::Response<axum::body::Body>> {
    Ok(router(env).call(req).await?)
}

async fn health() -> Json<Value> {
    Json(json!({ "ok": true }))
}

async fn find_name(db: &D1Database, id: u32) -> worker::Result<Option<NameRow>> {
    db.prepare("SELECT id, name, first_city, city_count FROM names WHERE id = ?1")
        .bind(&[id.into()])?
        .first(None)
        .await
}

async fn random_name_for_round(
    db: &D1Database,
    round: u32,
) -> std::result::Result<NameRow, AppError> {
    let (min, max) = game::id_range_for_round(round)
        .ok_or_else(|| AppError::Internal(format!("no id range for round {round}")))?;
    let id = random_id(min, max);
    find_name(db, id)
        .await?
        .ok_or_else(|| AppError::Internal(format!("random name id {id} not found")))
}

#[worker::send]
async fn freeplay_start(Extension(env): Extension<Env>) -> ApiResult<FreeplayStart> {
    let db = env.d1("DB")?;
    let now = util::now_secs();

    db.prepare("DELETE FROM freeplay_games WHERE created_at < ?1")
        .bind(&[((now - FREEPLAY_GAME_SECS) as f64).into()])?
        .run()
        .await?;

    let name = random_name_for_round(&db, 1).await?;
    let game_id = util::random_uuid()?;
    db.prepare("INSERT INTO freeplay_games (id, name_id, created_at) VALUES (?1, ?2, ?3)")
        .bind(&[game_id.as_str().into(), name.id.into(), (now as f64).into()])?
        .run()
        .await?;

    Ok(Json(FreeplayStart {
        game_id,
        next: NextRound {
            round: 1,
            name: name.name,
        },
    }))
}

#[worker::send]
async fn freeplay_guess(
    Extension(env): Extension<Env>,
    headers: HeaderMap,
    Json(req): Json<FreeplayGuessRequest>,
) -> ApiResult<RoundGuessResponse> {
    validate_coords(req.lat, req.lon)?;
    let db = env.d1("DB")?;

    let row: FreeplayRow = db
        .prepare("SELECT round, name_id FROM freeplay_games WHERE id = ?1")
        .bind(&[req.game_id.as_str().into()])?
        .first(None)
        .await?
        .ok_or(AppError::NotFound("game not found, start a new one"))?;
    let Some(name_id) = row.name_id else {
        return Err(AppError::BadRequest("already finished"));
    };

    let result = score_guess(&db, name_id, req.lat, req.lon).await?;

    let next_name = if row.round + 1 < 5 {
        Some(random_name_for_round(&db, row.round + 2).await?)
    } else {
        None
    };
    let next_id = next_name.as_ref().map_or(JsValue::NULL, |n| n.id.into());

    let updated: PlayRow = db
        .prepare(
            "UPDATE freeplay_games SET round = round + 1, score = score + ?1, name_id = ?2 \
             WHERE id = ?3 AND round = ?4 \
             RETURNING round, score",
        )
        .bind(&[
            result.score.into(),
            next_id,
            req.game_id.as_str().into(),
            row.round.into(),
        ])?
        .first(None)
        .await?
        .ok_or(AppError::Conflict("round already answered"))?;

    if next_name.is_none() {
        if let Some(user_id) = auth::current_user_id(&db, &headers).await? {
            update_best(&db, user_id, updated.score).await?;
        }
    }

    Ok(Json(RoundGuessResponse {
        result,
        total: updated.score,
        next: next_name.map(|n| NextRound {
            round: updated.round + 1,
            name: n.name,
        }),
    }))
}

async fn find_cities(db: &D1Database, first: u32, count: u32) -> worker::Result<Vec<CityRow>> {
    let last = first + count - 1;
    db.prepare("SELECT name, country, lat, lon FROM cities WHERE id BETWEEN ?1 AND ?2 ORDER BY id")
        .bind(&[first.into(), last.into()])?
        .all()
        .await?
        .results()
}

#[worker::send]
async fn daily_start(
    Extension(env): Extension<Env>,
    headers: HeaderMap,
) -> std::result::Result<axum::response::Response, AppError> {
    let db = env.d1("DB")?;
    let date = utc_date(0);

    let (player, set_cookie) = match current_player(&db, &headers).await? {
        Some(p) => (p, None),
        None => {
            let (id, cookie) = guest::get_or_create_guest(&headers)?;
            (Player::Guest(id), cookie)
        }
    };
    let player_id = player.key();

    db.prepare("INSERT INTO daily_plays (player_id, date) VALUES (?1, ?2) ON CONFLICT DO NOTHING")
        .bind(&[player_id.as_str().into(), date.as_str().into()])?
        .run()
        .await?;

    let row: PlayHistoryRow = db
        .prepare("SELECT round, score, scores FROM daily_plays WHERE player_id = ?1 AND date = ?2")
        .bind(&[player_id.as_str().into(), date.as_str().into()])?
        .first(None)
        .await?
        .ok_or_else(|| AppError::Internal("daily row missing after insert".to_string()))?;

    let secret = env.secret("DAILY_SECRET")?.to_string();
    let ids = game::daily_name_ids(game::daily_seed(&secret, &date));

    let mut scores: Vec<Option<u32>> = row
        .scores
        .split(',')
        .filter(|s| !s.is_empty())
        .map(|s| s.parse().ok())
        .collect();
    if scores.len() != row.round as usize {
        scores = vec![None; row.round as usize];
    }

    let mut history = Vec::with_capacity(scores.len());
    for (i, score) in scores.into_iter().enumerate() {
        let name = find_name(&db, ids[i])
            .await?
            .ok_or_else(|| AppError::Internal("daily name id not found".to_string()))?;
        history.push(PlayedRound {
            name: name.name,
            score,
        });
    }

    let next = if row.round < 5 {
        let name = find_name(&db, ids[row.round as usize])
            .await?
            .ok_or_else(|| AppError::Internal("daily name id not found".to_string()))?;
        Some(NextRound {
            round: row.round + 1,
            name: name.name,
        })
    } else {
        None
    };

    let state = DailyState {
        date,
        total: row.score,
        history,
        next,
    };

    with_cookie(Json(state), set_cookie)
}

#[worker::send]
async fn daily_guess(
    Extension(env): Extension<Env>,
    headers: HeaderMap,
    Json(req): Json<DailyGuessRequest>,
) -> ApiResult<RoundGuessResponse> {
    validate_coords(req.lat, req.lon)?;

    if req.date != utc_date(0) && req.date != utc_date(1) {
        return Err(AppError::BadRequest("that daily challenge is over"));
    }

    let db = env.d1("DB")?;

    let player = current_player(&db, &headers)
        .await?
        .ok_or(AppError::BadRequest("start the daily challenge first"))?;
    let player_id = player.key();

    let row: PlayRow = db
        .prepare("SELECT round, score FROM daily_plays WHERE player_id = ?1 AND date = ?2")
        .bind(&[player_id.as_str().into(), req.date.as_str().into()])?
        .first(None)
        .await?
        .ok_or(AppError::NotFound("daily challenge not started"))?;
    if row.round >= 5 {
        return Err(AppError::BadRequest("already finished"));
    }

    let secret = env.secret("DAILY_SECRET")?.to_string();
    let ids = game::daily_name_ids(game::daily_seed(&secret, &req.date));
    let result = score_guess(&db, ids[row.round as usize], req.lat, req.lon).await?;

    let updated: PlayRow = db
        .prepare(
            "UPDATE daily_plays SET round = round + 1, score = score + ?1, \
             scores = CASE WHEN scores = '' THEN ?5 ELSE scores || ',' || ?5 END \
             WHERE player_id = ?2 AND date = ?3 AND round = ?4 \
             RETURNING round, score",
        )
        .bind(&[
            result.score.into(),
            player_id.as_str().into(),
            req.date.as_str().into(),
            row.round.into(),
            result.score.to_string().into(),
        ])?
        .first(None)
        .await?
        .ok_or(AppError::Conflict("round already answered"))?;

    let next = if updated.round < 5 {
        let name = find_name(&db, ids[updated.round as usize])
            .await?
            .ok_or_else(|| AppError::Internal("daily name id not found".to_string()))?;
        Some(NextRound {
            round: updated.round + 1,
            name: name.name,
        })
    } else {
        match &player {
            Player::User(user_id) => {
                record_finish(&db, &req.date, updated.score, None).await?;
                update_best(&db, *user_id, updated.score).await?;
            }
            Player::Guest(_) => {
                let ip = guest::ip_hash(&headers, &secret, &req.date);
                record_finish(&db, &req.date, updated.score, Some(&ip)).await?;
            }
        }
        None
    };

    Ok(Json(RoundGuessResponse {
        result,
        total: updated.score,
        next,
    }))
}

async fn score_guess(
    db: &D1Database,
    name_id: u32,
    lat: f64,
    lon: f64,
) -> std::result::Result<GuessResponse, AppError> {
    let name = find_name(db, name_id)
        .await?
        .ok_or(AppError::NotFound("name not found"))?;
    let cities = find_cities(db, name.first_city, name.city_count).await?;
    let points: Vec<(f64, f64)> = cities.iter().map(|c| (c.lat, c.lon)).collect();
    let (closest, distance_m) = game::closest(lat, lon, &points)
        .ok_or_else(|| AppError::Internal(format!("name {} has no cities", name.id)))?;
    let score = game::score(distance_m);
    Ok(GuessResponse {
        distance_m,
        score,
        closest,
        cities,
    })
}

async fn record_finish(
    db: &D1Database,
    date: &str,
    score: u32,
    ip_hash: Option<&str>,
) -> worker::Result<()> {
    if let Some(ip) = ip_hash {
        let row: Option<CountRow> = db
            .prepare(
                "INSERT INTO guest_ip_counts (date, ip_hash, n) VALUES (?1, ?2, 1) \
                 ON CONFLICT (date, ip_hash) DO UPDATE SET n = n + 1 \
                 RETURNING n",
            )
            .bind(&[date.into(), ip.into()])?
            .first(None)
            .await?;
        if row.map_or(1, |r| r.n) > GUEST_LIMIT_PER_IP {
            return Ok(());
        }
    }

    db.prepare(
        "INSERT INTO daily_hist (date, bucket, count) VALUES (?1, ?2, 1) \
         ON CONFLICT (date, bucket) DO UPDATE SET count = count + 1",
    )
    .bind(&[date.into(), game::bucket_for(score).into()])?
    .run()
    .await?;

    Ok(())
}

#[worker::send]
async fn daily_histogram(
    Extension(env): Extension<Env>,
    headers: HeaderMap,
    Path(date): Path<String>,
) -> ApiResult<HistogramResponse> {
    if date.len() != 10 {
        return Err(AppError::BadRequest("date must look like 2026-10-15"));
    }
    let db = env.d1("DB")?;

    let rows: Vec<BucketRow> = db
        .prepare("SELECT bucket, count FROM daily_hist WHERE date = ?1")
        .bind(&[date.as_str().into()])?
        .all()
        .await?
        .results()?;

    let mut counts = vec![0u32; game::BUCKETS as usize];
    for r in &rows {
        if let Some(c) = counts.get_mut(r.bucket as usize) {
            *c = r.count;
        }
    }
    let players: u32 = counts.iter().sum();

    let mut your_score = None;
    if let Some(player) = current_player(&db, &headers).await? {
        let player_id = player.key();
        let row: Option<PlayRow> = db
            .prepare("SELECT round, score FROM daily_plays WHERE player_id = ?1 AND date = ?2")
            .bind(&[player_id.as_str().into(), date.as_str().into()])?
            .first(None)
            .await?;
        your_score = row.filter(|r| r.round >= 5).map(|r| r.score);
    }

    let better_than_percent = match your_score {
        Some(score) if players > 0 => {
            let your_bucket = game::bucket_for(score) as usize;
            let below: u32 = counts[..your_bucket].iter().sum();
            Some(below * 100 / players)
        }
        _ => None,
    };

    Ok(Json(HistogramResponse {
        date,
        bucket_starts: (0..game::BUCKETS).map(|i| i * game::BUCKET_SIZE).collect(),
        your_bucket: your_score.map(game::bucket_for),
        counts,
        players,
        your_score,
        better_than_percent,
    }))
}

async fn adopt_guest_play(
    db: &D1Database,
    headers: &HeaderMap,
    user_id: u32,
) -> worker::Result<()> {
    let Some(guest_id) = guest::read_guest_id(headers) else {
        return Ok(());
    };
    let user_player = format!("u:{user_id}");
    let guest_player = format!("g:{guest_id}");
    let date = utc_date(0);

    let moved: Option<PlayRow> = db
        .prepare(
            "UPDATE daily_plays SET player_id = ?1 \
         WHERE player_id = ?2 AND date = ?3 \
         AND NOT EXISTS (SELECT 1 FROM daily_plays WHERE player_id = ?1 AND date = ?3) \
         RETURNING round, score",
        )
        .bind(&[
            user_player.as_str().into(),
            guest_player.as_str().into(),
            date.as_str().into(),
        ])?
        .first::<PlayRow>(None)
        .await?;

    if let Some(play) = moved {
        if play.round >= 5 {
            update_best(db, user_id, play.score).await?;
        }
    }
    Ok(())
}

#[worker::send]
async fn register(
    Extension(env): Extension<Env>,
    headers: HeaderMap,
    Json(req): Json<Credentials>,
) -> std::result::Result<axum::response::Response, AppError> {
    let email = req.email.trim().to_lowercase();

    if !util::is_valid_email(&email) {
        return Err(AppError::BadRequest("please enter a valid email address"));
    }
    validate_password(&req.password)?;

    let db = env.d1("DB")?;
    let pw_hash = auth::hash_password(&req.password).await?;

    let user: IdRow = db
        .prepare(
            "INSERT INTO users (email, pw_hash) VALUES (?1, ?2) \
             ON CONFLICT (email) DO NOTHING RETURNING id",
        )
        .bind(&[email.as_str().into(), pw_hash.as_str().into()])?
        .first(None)
        .await?
        .ok_or(AppError::Conflict("email already registered"))?;

    adopt_guest_play(&db, &headers, user.id).await?;
    let cookie = auth::create_session(&db, user.id).await?;

    if let Err(e) = send_verification_email(&env, &db, user.id, &email).await {
        console_error!("verification email to new user {} failed: {e}", user.id);
    }

    with_cookie(Json(json!({ "email": email })), Some(cookie))
}

fn validate_password(password: &str) -> std::result::Result<(), AppError> {
    if !(8..=128).contains(&password.chars().count()) {
        return Err(AppError::BadRequest("password must be 8 to 128 characters"));
    }
    Ok(())
}

async fn send_verification_email(
    env: &Env,
    db: &D1Database,
    user_id: u32,
    to: &str,
) -> worker::Result<bool> {
    let Some(token) = email::create_token(db, user_id, email::VERIFY, email::VERIFY_SECS).await?
    else {
        return Ok(false);
    };
    email::send_verification(env, to, &token).await?;
    Ok(true)
}

#[worker::send]
async fn resend_verification(
    Extension(env): Extension<Env>,
    headers: HeaderMap,
) -> ApiResult<Value> {
    let db = env.d1("DB")?;
    let user_id = require_user(&db, &headers).await?;
    let profile = load_profile(&db, user_id).await?;
    if profile.email_verified {
        return Err(AppError::BadRequest("your email is already confirmed"));
    }
    if !send_verification_email(&env, &db, user_id, &profile.email).await? {
        return Err(AppError::TooManyRequests(
            "an email was just sent, please wait a minute",
        ));
    }
    Ok(Json(json!({ "ok": true })))
}

#[worker::send]
async fn verify_email(
    Extension(env): Extension<Env>,
    Json(req): Json<TokenRequest>,
) -> ApiResult<Value> {
    let db = env.d1("DB")?;
    let user_id = email::consume_token(&db, &req.token, email::VERIFY)
        .await?
        .ok_or(AppError::BadRequest("this link is invalid or has expired"))?;

    db.prepare(
        "UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?1) WHERE id = ?2",
    )
    .bind(&[(util::now_secs() as f64).into(), user_id.into()])?
    .run()
    .await?;
    db.prepare("DELETE FROM email_tokens WHERE user_id = ?1 AND purpose = ?2")
        .bind(&[user_id.into(), email::VERIFY.into()])?
        .run()
        .await?;
    Ok(Json(json!({ "ok": true })))
}

#[worker::send]
async fn forgot_password(
    Extension(env): Extension<Env>,
    Json(req): Json<EmailRequest>,
) -> ApiResult<Value> {
    let address = req.email.trim().to_lowercase();
    if !util::is_valid_email(&address) {
        return Err(AppError::BadRequest("please enter a valid email address"));
    }
    let db = env.d1("DB")?;

    let user: Option<IdRow> = db
        .prepare("SELECT id FROM users WHERE email = ?1")
        .bind(&[address.as_str().into()])?
        .first(None)
        .await?;
    if let Some(user) = user {
        let sent = match email::create_token(&db, user.id, email::RESET, email::RESET_SECS).await? {
            Some(token) => email::send_password_reset(&env, &address, &token).await,
            None => Ok(()),
        };
        if let Err(e) = sent {
            console_error!("password reset email to user {} failed: {e}", user.id);
        }
    }
    Ok(Json(json!({ "ok": true })))
}

#[worker::send]
async fn reset_password(
    Extension(env): Extension<Env>,
    headers: HeaderMap,
    Json(req): Json<ResetRequest>,
) -> std::result::Result<axum::response::Response, AppError> {
    validate_password(&req.password)?;
    let db = env.d1("DB")?;
    let user_id = email::consume_token(&db, &req.token, email::RESET)
        .await?
        .ok_or(AppError::BadRequest("this link is invalid or has expired"))?;

    let pw_hash = auth::hash_password(&req.password).await?;
    let user: EmailRow = db
        .prepare(
            "UPDATE users SET pw_hash = ?1, email_verified_at = COALESCE(email_verified_at, ?2) \
             WHERE id = ?3 RETURNING email",
        )
        .bind(&[
            pw_hash.as_str().into(),
            (util::now_secs() as f64).into(),
            user_id.into(),
        ])?
        .first(None)
        .await?
        .ok_or_else(|| AppError::Internal(format!("reset token for missing user {user_id}")))?;

    db.prepare("DELETE FROM sessions WHERE user_id = ?1")
        .bind(&[user_id.into()])?
        .run()
        .await?;
    db.prepare("DELETE FROM email_tokens WHERE user_id = ?1")
        .bind(&[user_id.into()])?
        .run()
        .await?;

    adopt_guest_play(&db, &headers, user_id).await?;
    let cookie = auth::create_session(&db, user_id).await?;
    with_cookie(Json(json!({ "email": user.email })), Some(cookie))
}

#[worker::send]
async fn login(
    Extension(env): Extension<Env>,
    headers: HeaderMap,
    Json(req): Json<Credentials>,
) -> std::result::Result<axum::response::Response, AppError> {
    const WRONG: AppError = AppError::Unauthorized("wrong email or password");

    let email = req.email.trim().to_lowercase();
    if req.password.chars().count() > 128 {
        return Err(WRONG);
    }
    let db = env.d1("DB")?;

    let row: Option<LoginRow> = db
        .prepare("SELECT id, pw_hash FROM users WHERE email = ?1")
        .bind(&[email.as_str().into()])?
        .first(None)
        .await?;

    let Some(user) = row else {
        auth::verify_password(&req.password, auth::DUMMY_HASH).await?;
        return Err(WRONG);
    };

    if !auth::verify_password(&req.password, &user.pw_hash).await? {
        return Err(WRONG);
    }

    adopt_guest_play(&db, &headers, user.id).await?;
    let cookie = auth::create_session(&db, user.id).await?;
    with_cookie(Json(json!({ "email": email })), Some(cookie))
}

#[worker::send]
async fn logout(
    Extension(env): Extension<Env>,
    headers: HeaderMap,
) -> std::result::Result<axum::response::Response, AppError> {
    if let Some(token) = util::read_cookie(&headers, "session") {
        let db = env.d1("DB")?;
        db.prepare("DELETE FROM sessions WHERE token_hash = ?1")
            .bind(&[util::sha256_hex(&token).into()])?
            .run()
            .await?;
    }
    let clear = "session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax".to_string();
    with_cookie(Json(json!({ "ok": true })), Some(clear))
}

#[worker::send]
async fn me(Extension(env): Extension<Env>, headers: HeaderMap) -> ApiResult<Profile> {
    let db = env.d1("DB")?;
    let user_id = require_user(&db, &headers).await?;
    Ok(Json(load_profile(&db, user_id).await?))
}

async fn current_player(db: &D1Database, headers: &HeaderMap) -> worker::Result<Option<Player>> {
    if let Some(user_id) = auth::current_user_id(db, headers).await? {
        return Ok(Some(Player::User(user_id)));
    }
    Ok(guest::read_guest_id(headers).map(Player::Guest))
}

async fn update_best(db: &D1Database, user_id: u32, score: u32) -> worker::Result<()> {
    db.prepare("UPDATE users SET best_score = ?1 WHERE id = ?2 AND best_score < ?1")
        .bind(&[score.into(), user_id.into()])?
        .run()
        .await?;
    Ok(())
}

async fn require_user(db: &D1Database, headers: &HeaderMap) -> std::result::Result<u32, AppError> {
    auth::current_user_id(db, headers)
        .await?
        .ok_or(AppError::Unauthorized("not logged in"))
}

async fn load_profile(db: &D1Database, user_id: u32) -> std::result::Result<Profile, AppError> {
    let row: ProfileRow = db
        .prepare(
            "SELECT email, email_verified_at IS NOT NULL AS verified, best_score, theme, units \
             FROM users WHERE id = ?1",
        )
        .bind(&[user_id.into()])?
        .first(None)
        .await?
        .ok_or_else(|| AppError::Internal(format!("session for missing user {user_id}")))?;
    Ok(Profile {
        email: row.email,
        email_verified: row.verified != 0,
        best_score: row.best_score,
        theme: row.theme,
        units: row.units,
    })
}

#[worker::send]
async fn update_settings(
    Extension(env): Extension<Env>,
    headers: HeaderMap,
    Json(req): Json<SettingsRequest>,
) -> ApiResult<Profile> {
    if !matches!(
        req.theme.as_deref(),
        None | Some("system" | "light" | "dark")
    ) {
        return Err(AppError::BadRequest("theme must be system, light or dark"));
    }
    if !matches!(req.units.as_deref(), None | Some("metric" | "imperial")) {
        return Err(AppError::BadRequest("units must be metric or imperial"));
    }

    let db = env.d1("DB")?;
    let user_id = require_user(&db, &headers).await?;
    let theme = req.theme.as_deref().map_or(JsValue::NULL, JsValue::from);
    let units = req.units.as_deref().map_or(JsValue::NULL, JsValue::from);
    db.prepare(
        "UPDATE users SET theme = COALESCE(?1, theme), units = COALESCE(?2, units) WHERE id = ?3",
    )
    .bind(&[theme, units, user_id.into()])?
    .run()
    .await?;

    Ok(Json(load_profile(&db, user_id).await?))
}

fn random_id(min: u32, max: u32) -> u32 {
    let random_num = js_sys::Math::random();
    let range = max - min + 1;
    min + (random_num * range as f64).floor() as u32
}

fn utc_date(days_ago: u32) -> String {
    let ms = js_sys::Date::now() - days_ago as f64 * 86_400_000.0;
    let iso: String = js_sys::Date::new(&JsValue::from_f64(ms))
        .to_iso_string()
        .into();
    iso[..10].to_string()
}

fn with_cookie(
    body: impl IntoResponse,
    set_cookie: Option<String>,
) -> std::result::Result<axum::response::Response, AppError> {
    let mut res = body.into_response();
    if let Some(cookie) = set_cookie {
        let value = cookie
            .parse()
            .map_err(|_| AppError::Internal("bad cookie value".to_string()))?;
        res.headers_mut().insert(SET_COOKIE, value);
    }
    Ok(res)
}

fn validate_coords(lat: f64, lon: f64) -> std::result::Result<(), AppError> {
    if !(-90.0..=90.0).contains(&lat) {
        return Err(AppError::BadRequest("lat must be between -90 and 90"));
    }
    if !(-180.0..=180.0).contains(&lon) {
        return Err(AppError::BadRequest("lon must be between -180 and 180"));
    }
    Ok(())
}
