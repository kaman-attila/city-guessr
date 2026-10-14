use axum::Json;
use axum::{routing::get, Router};
use serde_json::{json, Value};
use tower_service::Service;
use worker::*;

mod game;

fn router() -> Router {
    Router::new()
        .route("/", get(root))
        .route("/api/health", get(health))
}

#[event(fetch)]
async fn fetch(
    req: HttpRequest,
    _env: Env,
    _ctx: Context,
) -> Result<axum::http::Response<axum::body::Body>> {
    Ok(router().call(req).await?)
}

pub async fn root() -> &'static str {
    "Hello Axum!"
}

async fn health() -> Json<Value> {
    Json(json!({ "ok": true }))
}
