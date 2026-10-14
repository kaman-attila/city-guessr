use axum::{
    extract::Path,
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Extension, Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tower_service::Service;
use worker::*;

mod game;

enum AppError {
    BadRequest(&'static str),
    NotFound(&'static str),
    Internal(String),
}

type ApiResult<T> = std::result::Result<Json<T>, AppError>;

impl IntoResponse for AppError {
    fn into_response(self) -> axum::response::Response {
        let (status, message) = match self {
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg),
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, msg),
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

#[derive(Serialize, Deserialize)]
struct NameRow {
    id: u32,
    name: String,
    first_city: u32,
    city_count: u32,
}

#[derive(Serialize)]
struct RoundResponse {
    round: u32,
    name_id: u32,
    name: String,
}

#[derive(Deserialize)]
struct GuessRequest {
    name_id: u32,
    lat: f64,
    lon: f64,
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

fn router(env: Env) -> Router {
    Router::new()
        .route("/", get(root))
        .route("/api/health", get(health))
        .route("/api/names/{id}", get(get_name))
        .route("/api/freeplay/round/{n}", get(freeplay_round))
        .route("/api/guess", post(guess))
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

pub async fn root() -> &'static str {
    "Hello Axum!"
}

async fn health() -> Json<Value> {
    Json(json!({ "ok": true }))
}

#[worker::send]
async fn get_name(Extension(env): Extension<Env>, Path(id): Path<u32>) -> ApiResult<NameRow> {
    let db = env.d1("DB")?;
    let row = find_name(&db, id)
        .await?
        .ok_or(AppError::NotFound("name not found"))?;
    Ok(Json(row))
}

async fn find_name(db: &D1Database, id: u32) -> worker::Result<Option<NameRow>> {
    db.prepare("SELECT id, name, first_city, city_count FROM names WHERE id = ?1")
        .bind(&[id.into()])?
        .first(None)
        .await
}

#[worker::send]
async fn freeplay_round(
    Extension(env): Extension<Env>,
    Path(round): Path<u32>,
) -> ApiResult<RoundResponse> {
    let (min, max) =
        game::id_range_for_round(round).ok_or(AppError::BadRequest("round must be 1 to 5"))?;
    let id = random_id(min, max);
    let db = env.d1("DB")?;

    let row = find_name(&db, id)
        .await?
        .ok_or_else(|| AppError::Internal(format!("random name id {id} not found")))?;

    Ok(Json(RoundResponse {
        round,
        name_id: row.id,
        name: row.name,
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
async fn guess(
    Extension(env): Extension<Env>,
    Json(req): Json<GuessRequest>,
) -> ApiResult<GuessResponse> {
    if !(-90.0..=90.0).contains(&req.lat) {
        return Err(AppError::BadRequest("lat must be between -90 and 90"));
    }
    if !(-180.0..=180.0).contains(&req.lon) {
        return Err(AppError::BadRequest("lon must be between -180 and 180"));
    }

    let db = env.d1("DB")?;

    let name = find_name(&db, req.name_id)
        .await?
        .ok_or(AppError::NotFound("name not found"))?;

    let cities = find_cities(&db, name.first_city, name.city_count).await?;

    let points: Vec<(f64, f64)> = cities.iter().map(|c| (c.lat, c.lon)).collect();
    let (closest, distance_m) = game::closest(req.lat, req.lon, &points)
        .ok_or_else(|| AppError::Internal(format!("name {} has no cities", name.id)))?;
    let score = game::score(distance_m);

    Ok(Json(GuessResponse {
        distance_m,
        score,
        closest,
        cities,
    }))
}

fn random_id(min: u32, max: u32) -> u32 {
    let random_num = js_sys::Math::random();
    let range = max - min + 1;
    min + (random_num * range as f64).floor() as u32
}
