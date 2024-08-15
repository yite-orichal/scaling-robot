use log::debug;
use rand::{thread_rng, Rng};
use serde_json::json;
use solana_sdk::pubkey;
use solana_sdk::pubkey::Pubkey;

use crate::error::AppError;

#[allow(unused)]
const MAX_RECENT_BLOCKHASHES: u64 = 300;

const JITO_TIP_ACCOUNTS: [Pubkey; 8] = [
    pubkey!("Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY"),
    pubkey!("ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt"),
    pubkey!("96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5"),
    pubkey!("HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe"),
    pubkey!("ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49"),
    pubkey!("DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh"),
    pubkey!("DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL"),
    pubkey!("3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT"),
];

pub struct JitoRpcClient {
    pub http_client: reqwest::Client,
    pub base_url: String,
}

impl JitoRpcClient {
    async fn request(&self, req_body: serde_json::Value) -> Result<serde_json::Value, AppError> {
        let api_url = format!("{}/api/v1/bundles", self.base_url);
        let resp = self
            .http_client
            .post(api_url)
            .body(req_body.to_string())
            .header("Content-Type", "application/json")
            .send()
            .await?;

        let resp_json: serde_json::Value = resp.json().await?;
        Ok(resp_json)
    }

    pub fn get_tip_account() -> Pubkey {
        let idx: usize = thread_rng().gen_range(0..8);
        JITO_TIP_ACCOUNTS[idx]
    }

    pub async fn send_bundle(&self, bs58_txs: &[String]) -> Result<String, AppError> {
        let req_body = json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "sendBundle",
            "params": [bs58_txs]
        });

        debug!("send request to jito: {req_body}");
        let resp_json = self.request(req_body).await?;
        debug!("jito response: {resp_json}");

        let result = resp_json
            .get("result")
            .and_then(|it| it.as_str())
            .map(|it| it.to_string())
            .ok_or_else(|| AppError::new("no bundle id return"))?;
        Ok(result)
    }

    pub async fn get_tip_accounts(&self) -> Result<Vec<String>, AppError> {
        let req_body = json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getTipAccounts",
            "params": []
        });

        let resp_json = self.request(req_body).await?;
        let result = resp_json
            .get("result")
            .and_then(|it| it.as_array())
            .map(|it| {
                it.iter()
                    .filter_map(|addr| addr.as_str().map(|item| item.to_string()))
                    .collect::<Vec<_>>()
            });

        Ok(result.unwrap_or_default())
    }
}
