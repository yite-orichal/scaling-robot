use std::{
    io::{Read, Write},
    path::PathBuf,
};

use crate::{
    chain::Chain,
    commands::project::CreateProjectReq,
    error::AppError,
    wallet::{PrivateKey, WalletGrp},
};
use flate2::{read::GzDecoder, write::GzEncoder, Compression};
use serde::{Deserialize, Serialize};

use alloy::signers::local::PrivateKeySigner as EvmKeyPair;
use solana_sdk::signer::keypair::Keypair as SolKeypair;

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub chain: Chain,
    pub main_wallet: PrivateKey,
    pub rpc: String,
    pub agg_api_url: String,
    pub agg_api_key: Option<String>,
    pub proxy_urls: Vec<String>,
    pub wallet_grps: Vec<WalletGrp>,
}

impl From<CreateProjectReq> for Project {
    fn from(value: CreateProjectReq) -> Self {
        let main_wallet = match value.chain {
            Chain::Solana => SolKeypair::new().to_bytes().to_vec(),
            Chain::Base => EvmKeyPair::random().to_bytes().to_vec(),
        };

        Self {
            id: value.id,
            name: value.name,
            chain: value.chain,
            rpc: value.rpc,
            agg_api_url: value.agg_api_url,
            agg_api_key: value.agg_api_key,
            proxy_urls: value.proxy_urls,
            main_wallet,
            ..Default::default()
        }
    }
}

impl Project {
    pub async fn save(&self, path: impl Into<PathBuf>) -> Result<(), AppError> {
        let contents = bincode::serialize(&self)?;
        let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
        encoder.write_all(&contents)?;
        let contents = encoder.finish()?;
        let contents = [vec![b'm', b't', 0u8, 1u8], contents].concat();
        tokio::fs::write(path.into(), contents).await?;
        Ok(())
    }

    pub async fn read_from(path: impl Into<PathBuf>) -> Result<Self, AppError> {
        let contents = tokio::fs::read(path.into()).await?;
        if contents.len() < 4 {
            return Err(AppError::new("Wrong File Format"));
        }
        let mut decoder = GzDecoder::new(&contents[4..]);
        let mut contents = Vec::new();
        decoder.read_to_end(&mut contents).map_err(|_| AppError {
            err_msg: "Wrong File Format".to_owned(),
        })?;

        let proj = bincode::deserialize::<Project>(&contents)?;
        Ok(proj)
    }
}
