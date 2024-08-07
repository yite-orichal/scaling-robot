use alloy::signers::local::PrivateKeySigner;
use serde::Serialize;
use solana_sdk::signature::Keypair;
use solana_sdk::signer::Signer;
use tauri::{AppHandle, Emitter, EventTarget};

use crate::chain::Chain;
use crate::error::AppError;
use crate::wallet::PrivateKey;

pub trait TrimZeroChar {
    fn trim_zero_char(&self) -> Self;
}

impl TrimZeroChar for String {
    fn trim_zero_char(&self) -> String {
        self.trim_matches(char::from(0)).to_string()
    }
}

pub trait AppHandleExt {
    fn emit_trade_task_evt<P>(&self, label: impl Into<String>, payload: P)
    where
        P: Serialize + Clone;
}

impl AppHandleExt for AppHandle {
    fn emit_trade_task_evt<P>(&self, label: impl Into<String>, payload: P)
    where
        P: Serialize + Clone,
    {
        self.emit_to(
            EventTarget::webview_window(label),
            "trade_task_event",
            payload,
        )
        .unwrap();
    }
}

//////////////////////////////

pub fn parse_sol_bs58_pk(pk_str: &str) -> Result<Keypair, AppError> {
    let bytes = bs58::decode(pk_str).into_vec()?;
    let keypair = Keypair::from_bytes(&bytes)?;

    Ok(keypair)
}

pub fn pk_to_addr(chain: Chain, pk: &PrivateKey) -> Result<String, AppError> {
    let addr = match chain {
        Chain::Solana => {
            let k = Keypair::from_bytes(pk)?;
            k.pubkey().to_string()
        }
        Chain::Base => {
            let k = PrivateKeySigner::from_slice(pk)?;
            let pubkey = k.address();
            alloy::hex::encode_prefixed(pubkey)
        }
    };

    Ok(addr)
}

pub fn pk_to_string(chain: Chain, pk: &PrivateKey) -> Result<String, AppError> {
    let result = match chain {
        Chain::Solana => {
            let k = Keypair::from_bytes(pk)?;
            k.to_base58_string()
        }
        Chain::Base => {
            let k = PrivateKeySigner::from_slice(pk)?;
            alloy::hex::encode_prefixed(k.to_bytes())
        }
    };

    Ok(result)
}

pub fn create_pk(chain: Chain) -> PrivateKey {
    match chain {
        Chain::Solana => Keypair::new().to_bytes().to_vec(),
        Chain::Base => PrivateKeySigner::random().to_bytes().to_vec(),
    }
}
