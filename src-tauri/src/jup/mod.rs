use anyhow::{anyhow, Result};
use reqwest::Response;
use serde::de::DeserializeOwned;

use self::quote::{QuoteRequest, QuoteResponse};

use self::swap::{
    SwapInstructionsResponse, SwapInstructionsResponseInternal, SwapRequest, SwapResponse,
};

pub mod quote;
mod route_plan_with_metadata;
mod serde_helpers;
pub mod swap;
pub mod transaction_config;

async fn check_is_success(response: Response) -> Result<Response> {
    if !response.status().is_success() {
        return Err(anyhow!(
            "Request status not ok: {}, body: {:?}",
            response.status(),
            response.text().await
        ));
    }
    Ok(response)
}

async fn check_status_code_and_deserialize<T: DeserializeOwned>(response: Response) -> Result<T> {
    check_is_success(response)
        .await?
        .json::<T>()
        .await
        .map_err(Into::into)
}

pub async fn quote(
    http_client: &reqwest::Client,
    base_path: impl Into<String>,
    quote_request: &QuoteRequest,
) -> Result<QuoteResponse> {
    let query = serde_qs::to_string(&quote_request)?;
    let response = http_client
        .get(format!("{}/quote?{query}", base_path.into()))
        .send()
        .await?;
    check_status_code_and_deserialize(response).await
}

pub async fn swap(
    http_client: &reqwest::Client,
    base_path: impl Into<String>,
    swap_request: &SwapRequest,
) -> Result<SwapResponse> {
    let response = http_client
        .post(format!("{}/swap", base_path.into()))
        .json(swap_request)
        .send()
        .await?;
    check_status_code_and_deserialize(response).await
}

pub async fn swap_instructions(
    http_client: &reqwest::Client,
    base_path: impl Into<String>,
    swap_request: &SwapRequest,
) -> Result<SwapInstructionsResponse> {
    let response = http_client
        .post(format!("{}/swap-instructions", base_path.into()))
        .json(swap_request)
        .send()
        .await?;
    check_status_code_and_deserialize::<SwapInstructionsResponseInternal>(response)
        .await
        .map(Into::into)
}
