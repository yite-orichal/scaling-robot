use std::str::FromStr;

use alloy::{
    network::{EthereumWallet, TransactionBuilder},
    primitives::{
        utils::{format_ether, parse_ether},
        Address, U256,
    },
    providers::{Provider, ProviderBuilder},
    rpc::types::TransactionRequest,
    signers::local::PrivateKeySigner,
};
use serde::{Deserialize, Serialize};
use solana_sdk::{
    native_token::{lamports_to_sol, sol_to_lamports, LAMPORTS_PER_SOL},
    pubkey::Pubkey,
    signature::Keypair,
    signer::Signer,
};
use tauri::{command, AppHandle};

use crate::{
    chain::{Chain, SolRpcClientExt},
    consts::SOL_TX_BASE_FEE,
    contracts::MooTokenHubContract,
    error::AppError,
    state::AppHandleStateExt,
    token::TokenInfo,
};

#[derive(Debug, Serialize)]
pub struct AddrBalanceResp {
    pub addr: String,
    pub bal_ui: String,
    pub bal: String,
}

#[derive(Debug, Deserialize)]
pub struct AirdropReq {
    pub chain: Chain,
    pub from_pk: String,
    pub addrs: Vec<String>,
    pub per_amount: f64,
    pub per_w_amount: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct TransferNativeReq {
    pub chain: Chain,
    pub from_pk: String,
    pub addr: String,
    /// 'max' or float number
    pub amount: String,
}

#[command(async)]
pub async fn get_addr_balance(
    chain: Chain,
    addr: String,
    app_handle: AppHandle,
) -> Result<AddrBalanceResp, AppError> {
    let result = match chain {
        Chain::Solana => {
            let client = app_handle.read_sol_rpc_client().await?;
            let pubkey = Pubkey::from_str(&addr)?;
            let lamports = client.get_balance(&pubkey).await?;
            let bal_ui = lamports_to_sol(lamports).to_string();
            AddrBalanceResp {
                addr,
                bal: lamports.to_string(),
                bal_ui,
            }
        }
        Chain::Base | Chain::Bsc => {
            let provider = app_handle.read_evm_provider().await?;
            let address = Address::from_str(&addr)?;
            let bal = provider.get_balance(address).await?;
            let bal_ui = format_ether(bal);
            AddrBalanceResp {
                addr,
                bal: bal.to_string(),
                bal_ui,
            }
        }
    };

    Ok(result)
}

#[command(async)]
pub async fn get_token_info(
    chain: Chain,
    addr: String,
    app_handle: AppHandle,
) -> Result<TokenInfo, AppError> {
    let result = match chain {
        Chain::Solana => {
            let client = app_handle.read_sol_rpc_client().await?;
            TokenInfo::load_sol_token_info(addr.as_str(), &client).await?
        }
        Chain::Base | Chain::Bsc => {
            let client = app_handle.read_evm_provider().await?;
            TokenInfo::load_evm_token_info(chain, addr.as_str(), &client).await?
        }
    };

    Ok(result)
}

#[command(async, rename_all = "snake_case")]
pub async fn airdrop(req: AirdropReq, app_handle: AppHandle) -> Result<String, AppError> {
    let AirdropReq {
        chain,
        from_pk,
        addrs,
        per_amount,
        per_w_amount,
    } = req;

    let tx_id = match chain {
        Chain::Solana => {
            let rpc_client = app_handle.read_sol_rpc_client().await?;
            let pk_bytes = bs58::decode(&from_pk).into_vec()?;
            let from = Keypair::from_bytes(&pk_bytes)?;
            let per_amount = per_amount * LAMPORTS_PER_SOL as f64;
            let mut pubkeys = vec![];
            for addr in addrs {
                pubkeys.push(Pubkey::from_str(&addr)?);
            }
            let sign = rpc_client
                .batch_transfer_sol(from, &pubkeys, per_amount as u64)
                .await?;
            sign.to_string()
        }
        Chain::Base | Chain::Bsc => {
            let pk_bytes = alloy::hex::decode(&from_pk)?;
            let wallet_signer = PrivateKeySigner::from_slice(&pk_bytes)?;
            let wallet_address = wallet_signer.address();

            let mut addresses = vec![];
            for addr in addrs {
                addresses.push(Address::from_str(&addr)?);
            }

            let per_amount = parse_ether(&per_amount.to_string())?;
            let per_w_amount = parse_ether(&per_w_amount.unwrap_or_default().to_string())?;
            let value = (per_amount + per_w_amount) * U256::from(addresses.len());

            let rpc_client = app_handle.read_evm_rpc_client().await?;

            let rpc_provider = ProviderBuilder::new()
                .with_recommended_fillers()
                .wallet(EthereumWallet::from(wallet_signer))
                .on_client(rpc_client);

            let balance = rpc_provider.get_balance(wallet_address).await?;
            if balance < value {
                return Err(AppError::new("insufficient balance"));
            }

            let chain_config = chain.evm_chain_config().unwrap();
            let token_hub_addr = chain_config.moo_hub_addr;

            let token_hub_contract = MooTokenHubContract::new(token_hub_addr, rpc_provider.clone());
            let receipt = token_hub_contract
                .deposit(addresses, per_amount, per_w_amount)
                .value(value)
                .send()
                .await?
                .get_receipt()
                .await?;

            if !receipt.status() {
                return Err(AppError::new("transaction failed ...."));
            }

            receipt.transaction_hash.to_string()
        }
    };

    Ok(tx_id)
}

#[command(async, rename_all = "snake_case")]
pub async fn transfer_native(
    req: TransferNativeReq,
    app_handle: AppHandle,
) -> Result<String, AppError> {
    let txid = match req.chain {
        Chain::Solana => {
            let rpc_client = app_handle.read_sol_rpc_client().await?;
            let pk_bytes = bs58::decode(&req.from_pk).into_vec()?;
            let from = Keypair::from_bytes(&pk_bytes)?;
            let balance = rpc_client.get_balance(&from.pubkey()).await?;

            let amount = if req.amount.to_lowercase() == "max" {
                if SOL_TX_BASE_FEE > balance {
                    return Err(AppError::new("insufficient balance"));
                }

                balance - SOL_TX_BASE_FEE
            } else {
                sol_to_lamports(f64::from_str(&req.amount)?)
            };

            let pubkey = Pubkey::from_str(&req.addr)?;
            let sign = rpc_client
                .batch_transfer_sol(from, &[pubkey], amount)
                .await?;
            sign.to_string()
        }
        Chain::Base | Chain::Bsc => {
            let pk_bytes = alloy::hex::decode(&req.from_pk)?;
            let wallet_signer = PrivateKeySigner::from_slice(&pk_bytes)?;
            let wallet_addr = wallet_signer.address();

            let address = Address::from_str(&req.addr)?;

            let rpc_client = app_handle.read_evm_rpc_client().await?;
            let rpc_provider = ProviderBuilder::new()
                .with_recommended_fillers()
                .wallet(EthereumWallet::from(wallet_signer))
                .on_client(rpc_client);

            let balance = rpc_provider.get_balance(wallet_addr).await?;
            let mut gas_price = rpc_provider.get_gas_price().await?;
            // higher price
            gas_price += 100_000;
            let gas_limit = 21000u128;

            let value = if req.amount.to_lowercase() == "max" {
                let l1_gas = 1600u128;

                // OPTIM: use l1 rpc to get gas price
                // suppose 10gwei for now
                let l1_gas_price = 10_000_000_000u128;
                let l1_fee_need = l1_gas * l1_gas_price;

                let total_fee_needed = U256::from((gas_price * gas_limit) + l1_fee_need);
                if total_fee_needed > balance {
                    return Err(AppError::new("insufficient balance"));
                }
                balance - total_fee_needed
            } else {
                parse_ether(&req.amount)?
            };

            if balance < value {
                return Err(AppError::new("insufficient balance"));
            }

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
