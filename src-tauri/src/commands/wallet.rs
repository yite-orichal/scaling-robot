use std::{collections::HashSet, str::FromStr};

use crate::{
    chain::{Chain, SolRpcClientExt},
    consts::{BASE_WETH_ADDR, SOL_TX_BASE_FEE},
    contracts::WEthContract,
    error::AppError,
    state::{AppHandleStateExt, ProjectState},
    utils,
    wallet::WalletGrp,
};
use alloy::{
    network::{EthereumWallet, TransactionBuilder},
    primitives::{Address, U256},
    providers::{Provider, ProviderBuilder},
    rpc::types::TransactionRequest,
    signers::local::PrivateKeySigner,
};
use serde::{Deserialize, Serialize};
use solana_sdk::{pubkey::Pubkey, signature::Keypair, signer::Signer};
use tauri::{command, AppHandle, State};

#[derive(Debug, Serialize)]
pub struct WalletGrpResp {
    pub id: String,
    pub name: String,
    pub chain: Chain,
    pub addresses: HashSet<(String, String)>,
}

impl TryFrom<&WalletGrp> for WalletGrpResp {
    type Error = AppError;

    fn try_from(value: &WalletGrp) -> Result<Self, Self::Error> {
        let mut addresses = HashSet::new();

        for pk in &value.pks {
            let addr = utils::pk_to_addr(value.chain, pk)?;
            let pk_str = utils::pk_to_string(value.chain, pk)?;
            addresses.insert((addr, pk_str));
        }

        Ok(Self {
            id: value.id.clone(),
            name: value.name.clone(),
            chain: value.chain,
            addresses,
        })
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateWalletGrpReq {
    pub id: String,
    pub name: String,
    pub cnt: u32,
}

#[derive(Debug, Deserialize)]
pub struct ImportWalletGrpReq {
    pub id: String,
    pub name: String,
    pub pks: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct ExportWalletGrpReq {
    /// vec item format (addr, pk)
    pub pks: Vec<(String, String)>,
    pub path: String,
}

#[derive(Debug, Deserialize)]
pub struct WalletGrpWithdrawReq {
    pub chain: Chain,
    pub from_pk: String,
    pub addr: String,
}

#[command(async)]
pub async fn create_wallet_grp(
    req: CreateWalletGrpReq,
    state: State<'_, ProjectState>,
) -> Result<WalletGrpResp, AppError> {
    let guard = state.lock().await;
    let chain = guard
        .as_ref()
        .map(|s| s.project.chain)
        .ok_or_else(|| AppError::new("No Project Open"))?;
    drop(guard);

    let grp = WalletGrp::create_from_req(req, chain);
    let resp = WalletGrpResp::try_from(&grp)?;

    let mut guard = state.lock().await;
    if let Some(s) = guard.as_mut() {
        s.project.wallet_grps.push(grp);
        s.project.save(s.path.clone()).await?;
    }
    drop(guard);

    Ok(resp)
}

#[command(async)]
pub async fn import_wallet_grp(
    req: ImportWalletGrpReq,
    state: State<'_, ProjectState>,
) -> Result<WalletGrpResp, AppError> {
    let guard = state.lock().await;
    let chain = guard
        .as_ref()
        .map(|s| s.project.chain)
        .ok_or_else(|| AppError::new("No Project Open"))?;
    drop(guard);

    let grp = WalletGrp::create_from_import_req(req, chain)?;
    let resp = WalletGrpResp::try_from(&grp)?;

    let mut guard = state.lock().await;
    if let Some(s) = guard.as_mut() {
        s.project.wallet_grps.push(grp);
        s.project.save(s.path.clone()).await?;
    }
    drop(guard);

    Ok(resp)
}

#[command(async)]
pub async fn export_wallet_grp(req: ExportWalletGrpReq) -> Result<(), AppError> {
    let file_content = req
        .pks
        .into_iter()
        .map(|(addr, pk)| format!("{addr}, {pk}"))
        .collect::<Vec<_>>()
        .join("\n");
    tokio::fs::write(req.path, file_content).await?;

    Ok(())
}

#[command(async)]
pub async fn wallet_grp_withdraw(
    req: WalletGrpWithdrawReq,
    app_handle: AppHandle,
) -> Result<String, AppError> {
    let txid = match req.chain {
        Chain::Solana => {
            let rpc_client = app_handle.read_sol_rpc_client().await?;
            let pk_bytes = bs58::decode(&req.from_pk).into_vec()?;
            let from = Keypair::from_bytes(&pk_bytes)?;
            let balance = rpc_client.get_balance(&from.pubkey()).await?;
            if SOL_TX_BASE_FEE > balance {
                return Err(AppError::new("insufficient balance"));
            }

            let amount = balance - SOL_TX_BASE_FEE;

            let pubkey = Pubkey::from_str(&req.addr)?;
            let sign = rpc_client
                .batch_transfer_sol(from, &[pubkey], amount)
                .await?;
            sign.to_string()
        }
        Chain::Base => {
            let pk_bytes = alloy::hex::decode(&req.from_pk)?;
            let wallet_signer = PrivateKeySigner::from_slice(&pk_bytes)?;
            let wallet_addr = wallet_signer.address();

            let address = Address::from_str(&req.addr)?;

            let rpc_client = app_handle.read_evm_rpc_client().await?;
            let rpc_provider = ProviderBuilder::new()
                .with_recommended_fillers()
                .wallet(EthereumWallet::from(wallet_signer))
                .on_client(rpc_client);
            let weth_contract = WEthContract::new(BASE_WETH_ADDR, rpc_provider.clone());
            let weth_balance = weth_contract.balanceOf(wallet_addr).call().await?._0;
            if weth_balance > U256::ZERO {
                let withdraw_receipt = weth_contract
                    .withdraw(weth_balance)
                    .send()
                    .await?
                    .get_receipt()
                    .await?;

                if !withdraw_receipt.status() {
                    return Err(AppError::new("convert weth to eth error"));
                }
            }

            let balance = rpc_provider.get_balance(wallet_addr).await?;
            let mut gas_price = rpc_provider.get_gas_price().await?;
            // higher price
            gas_price += 100_000;
            let gas_limit = 21000u128;
            let l1_gas = 1600u128;
            // OPTIM: use l1 rpc to get gas price
            // suppose 1gwei for now
            let l1_gas_price = 1_000_000_000u128;
            let l1_fee_need = l1_gas * l1_gas_price;

            let total_fee_needed = U256::from((gas_price * gas_limit) + l1_fee_need);
            if total_fee_needed > balance {
                return Err(AppError::new("insufficient balance"));
            }

            let value = balance - total_fee_needed;

            let mut tx = TransactionRequest::default()
                .from(wallet_addr)
                .to(address)
                .value(value);

            tx.set_gas_limit(gas_limit);
            tx.set_gas_price(gas_price);

            let receipt = rpc_provider
                .send_transaction(tx)
                .await?
                .get_receipt()
                .await?;

            if !receipt.status() {
                return Err(AppError::new("transaction failed ...."));
            }

            receipt.transaction_hash.to_string()
        }
    };
    Ok(txid)
}
