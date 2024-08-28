use std::time::{Duration, Instant};

use alloy::primitives::Address;
use async_trait::async_trait;

use log::debug;
use serde::{Deserialize, Serialize};
use solana_client::nonblocking::rpc_client::RpcClient;
use solana_sdk::{
    address_lookup_table::{state::AddressLookupTable, AddressLookupTableAccount},
    message::{v0::Message, VersionedMessage},
    pubkey::Pubkey,
    signature::{Keypair, Signature},
    signer::Signer,
    system_instruction,
    transaction::VersionedTransaction,
};
use strum::Display;

use crate::{
    consts::{
        BASE_MOO_TOKEN_HUB_ADDR, BASE_ONE_INCH_V6_ROUTER_ADDR, BASE_WETH_ADDR,
        BSC_MOO_TOKEN_HUB_ADDR, BSC_ONE_INCH_V6_ROUTER_ADDR, BSC_WBNB_ADDR,
    },
    error::AppError,
};

pub struct EvmChainConfig {
    pub named_chain: alloy_chains::NamedChain,
    pub moo_hub_addr: Address,
    pub native_symbol: &'static str,
    pub wrapped_native_addr: Address,
    pub one_inch_router_addr: Address,
}

#[derive(Debug, Display, Copy, Clone, Serialize, Deserialize, Default)]
pub enum Chain {
    #[default]
    Solana,
    Base,
    Bsc,
}

impl Chain {
    pub fn evm_chain_config(&self) -> Option<EvmChainConfig> {
        match self {
            Chain::Solana => None,
            Chain::Base => Some(EvmChainConfig {
                named_chain: alloy_chains::NamedChain::Base,
                moo_hub_addr: BASE_MOO_TOKEN_HUB_ADDR,
                native_symbol: "ETH",
                wrapped_native_addr: BASE_WETH_ADDR,
                one_inch_router_addr: BASE_ONE_INCH_V6_ROUTER_ADDR,
            }),
            Chain::Bsc => Some(EvmChainConfig {
                named_chain: alloy_chains::NamedChain::BinanceSmartChain,
                moo_hub_addr: BSC_MOO_TOKEN_HUB_ADDR,
                native_symbol: "BNB",
                wrapped_native_addr: BSC_WBNB_ADDR,
                one_inch_router_addr: BSC_ONE_INCH_V6_ROUTER_ADDR,
            }),
        }
    }
}

#[async_trait]
pub trait SolRpcClientExt {
    async fn batch_transfer_sol(
        &self,
        from: Keypair,
        to: &[Pubkey],
        per_amount: u64,
    ) -> Result<String, AppError>;

    async fn get_address_lookup_tables(
        &self,
        pubkeys: &[Pubkey],
    ) -> Result<Vec<AddressLookupTableAccount>, AppError>;

    async fn confirm_tx(&self, txid: Signature) -> Result<(), AppError>;
}

#[async_trait]
impl SolRpcClientExt for RpcClient {
    async fn batch_transfer_sol(
        &self,
        from: Keypair,
        to: &[Pubkey],
        per_amount: u64,
    ) -> Result<String, AppError> {
        let total_need = per_amount * to.len() as u64;

        let from_pubkey = from.pubkey();
        let from_bal = self.get_balance(&from_pubkey).await?;
        if from_bal < total_need {
            let err_msg = format!(
                "{} balance not enough, balance is: {}, need: {}",
                from_pubkey, from_bal, total_need
            );
            return Err(AppError::new(err_msg));
        }

        let mut to_lamports = Vec::new();
        for to_pubkey in to {
            to_lamports.push((*to_pubkey, per_amount));
        }

        let transfer_ixs = system_instruction::transfer_many(&from_pubkey, &to_lamports);

        let recent_blockhash = self.get_latest_blockhash().await?;
        let tx_msg = Message::try_compile(&from_pubkey, &transfer_ixs, &[], recent_blockhash)?;
        let tx_msg = VersionedMessage::V0(tx_msg);
        let tx = VersionedTransaction::try_new(tx_msg, &[&from])?;

        let sign = self.send_transaction(&tx).await?;

        self.confirm_tx(sign).await?;

        Ok(sign.to_string())
    }

    async fn get_address_lookup_tables(
        &self,
        pubkeys: &[Pubkey],
    ) -> Result<Vec<AddressLookupTableAccount>, AppError> {
        if pubkeys.is_empty() {
            return Ok(vec![]);
        }

        let account_infos = self.get_multiple_accounts(pubkeys).await?;

        let mut result = vec![];
        for (idx, info) in account_infos.iter().enumerate() {
            if let Some(info) = info {
                let tb = AddressLookupTable::deserialize(&info.data)?;
                let tb_acc = AddressLookupTableAccount {
                    key: pubkeys[idx],
                    addresses: tb.addresses.to_vec(),
                };
                result.push(tb_acc);
            }
        }

        Ok(result)
    }

    async fn confirm_tx(&self, txid: Signature) -> Result<(), AppError> {
        let start_time = Instant::now();
        loop {
            tokio::time::sleep(Duration::from_secs(2)).await;
            debug!("confirming tranaction {} ...", txid);
            let statuses = self.get_signature_statuses(&[txid]).await?.value;

            if let Some(status) = statuses[0].clone() {
                if let Some(err) = status.err {
                    return Err(AppError::new(err.to_string()));
                } else {
                    break;
                }
            }

            // NOTE: max tx expire time 120s in solana_sdk
            //
            if start_time.elapsed().as_secs() > 120 {
                return Err(AppError::new("transaction not confirmed after 120 seconds"));
            }
        }

        Ok(())
    }
}
