use axum::{extract::Path, http::StatusCode, routing::get, Extension, Json, Router};
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

fn router(env: Env) -> Router {
    Router::new()
        .route("/", get(root))
        .route("/api/health", get(health))
        .route("/api/names/{id}", get(get_name))
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

    let stmt = db
        .prepare("SELECT id, name, first_city, city_count FROM names WHERE id = ?1")
        .bind(&[id.into()])
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let row: Option<NameRow> = stmt
        .first(None)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    match row {
        Some(row) => Ok(Json(row)),
        None => Err(StatusCode::NOT_FOUND),
    }
}
