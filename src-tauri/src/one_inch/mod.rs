use std::str::FromStr;

use alloy::{
    network::TransactionBuilder,
    primitives::{Address, Bytes, U256},
    rpc::types::TransactionRequest,
};
use serde::{Deserialize, Serialize};
use serde_with::{serde_as, DisplayFromStr};

use crate::error::AppError;

#[serde_as]
#[derive(Debug, Serialize)]
pub struct SwapQueryParams {
    pub src: Address,
    pub dst: Address,

    #[serde_as(as = "DisplayFromStr")]
    pub amount: U256,
    pub from: Address,
    pub origin: Address,
    pub slippage: u16,
}

#[allow(unused)]
#[serde_as]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SwapResponse {
    #[serde_as(as = "DisplayFromStr")]
    pub dst_amount: U256,
    pub tx: SwapTxData,
}

#[allow(unused)]
#[serde_as]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SwapTxData {
    pub data: String,
    pub from: Address,
    pub gas: u128,
    #[serde_as(as = "DisplayFromStr")]
    pub gas_price: U256,
    pub to: Address,
    #[serde_as(as = "DisplayFromStr")]
    pub value: U256,
}

impl TryFrom<SwapTxData> for TransactionRequest {
    type Error = AppError;

    fn try_from(value: SwapTxData) -> Result<Self, Self::Error> {
        let gas_price: u128 = value.gas_price.try_into()?;
        let input_bytes = Bytes::from_str(&value.data)?;
        let result = TransactionRequest::default()
            .from(value.from)
            .to(value.to)
            .value(value.value)
            .with_input(input_bytes)
            .with_gas_price(gas_price);
        Ok(result)
    }
}

pub async fn get_swap_data(
    client: &reqwest::Client,
    base_url: &str,
    api_key: &str,
    chain_id: u64,
    query: SwapQueryParams,
) -> Result<SwapResponse, AppError> {
    let query_params = serde_qs::to_string(&query)?;
    let api_url = format!("{base_url}/swap/v6.0/{chain_id}/swap?{query_params}");
    let auth_header_value = format!("Bearer {api_key}");

    let resp = client
        .get(api_url)
        .header("Authorization", auth_header_value)
        .send()
        .await?;
    let resp_data = resp.json::<SwapResponse>().await?;

    Ok(resp_data)
}
