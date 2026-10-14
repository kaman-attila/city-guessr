use axum::{
    extract::Path,
    http::StatusCode,
    routing::{get, post},
    Extension, Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tower_service::Service;
use worker::*;

mod game;

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
async fn get_name(
    Extension(env): Extension<Env>,
    Path(id): Path<u32>,
) -> std::result::Result<Json<NameRow>, StatusCode> {
    let db = env
        .d1("DB")
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let row = find_name(&db, id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    row.map(Json).ok_or(StatusCode::NOT_FOUND)
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
) -> std::result::Result<Json<RoundResponse>, StatusCode> {
    let (min, max) = game::id_range_for_round(round).ok_or(StatusCode::BAD_REQUEST)?;
    let id = random_id(min, max);
    let db = env
        .d1("DB")
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let row = find_name(&db, id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::INTERNAL_SERVER_ERROR)?;

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
) -> std::result::Result<Json<GuessResponse>, StatusCode> {
    if !(-90.0..=90.0).contains(&req.lat) || !(-180.0..=180.0).contains(&req.lon) {
        return Err(StatusCode::BAD_REQUEST);
    }

    let db = env
        .d1("DB")
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let name = find_name(&db, req.name_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let cities = find_cities(&db, name.first_city, name.city_count)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let points: Vec<(f64, f64)> = cities.iter().map(|c| (c.lat, c.lon)).collect();
    let (closest, distance_m) =
        game::closest(req.lat, req.lon, &points).ok_or(StatusCode::INTERNAL_SERVER_ERROR)?;
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
