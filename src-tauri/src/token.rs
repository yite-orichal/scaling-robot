use std::str::FromStr;

use mpl_token_metadata::accounts::Metadata;
use serde::{Deserialize, Serialize};
use solana_client::nonblocking::rpc_client::RpcClient;
use solana_program::pubkey::Pubkey;
use solana_sdk::{program_pack::Pack, pubkey};
use spl_token::state::Mint;

use crate::{
    chain::Chain, contracts::Erc20Contract, error::AppError, state::EvmRpcProvider,
    utils::TrimZeroChar,
};
use alloy::primitives::Address;

pub const MPL_TOKEN_METADATA_ID: Pubkey = pubkey!("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
fn find_metadata_pda(mint: &Pubkey) -> Pubkey {
    let (metadata_pubkey, _) = Pubkey::find_program_address(
        &[
            "metadata".as_bytes(),
            MPL_TOKEN_METADATA_ID.as_ref(),
            mint.as_ref(),
        ],
        &MPL_TOKEN_METADATA_ID,
    );
    metadata_pubkey
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenInfo {
    pub chain: Chain,
    pub addr: String,
    pub name: String,
    pub symbol: String,
    pub decimals: u8,
}

impl TokenInfo {
    pub async fn load_sol_token_info(mint_str: &str, client: &RpcClient) -> Result<Self, AppError> {
        let mint = Pubkey::from_str(mint_str)?;

        let metadata_pubkey = find_metadata_pda(&mint);
        let accounts = client
            .get_multiple_accounts(&[mint, metadata_pubkey])
            .await?;

        let (opt_mint, opt_meta) = match &accounts[..] {
            [opt_mint, opt_meta] => (opt_mint, opt_meta),
            _ => return Err(AppError::new("fetch token accounts from chain error")),
        };

        if opt_mint.is_none() {
            return Err(AppError::new(format!("token mint not found: {mint}")));
        }

        let mint_account = opt_mint.clone().unwrap();
        let mint_data = Mint::unpack(&mint_account.data)?;
        let mut name = "Unknown".to_string();
        let mut symbol = "Unknown".to_string();

        if let Some(meta_account) = opt_meta {
            let meta_data = Metadata::from_bytes(&meta_account.data)?;
            name = meta_data.name.trim_zero_char();
            symbol = meta_data.symbol.trim_zero_char();
        }

        Ok(TokenInfo {
            chain: Chain::Solana,
            addr: mint_str.to_string(),
            name,
            symbol,
            decimals: mint_data.decimals,
        })
    }

    pub async fn load_evm_token_info(
        chain: Chain,
        addr: &str,
        client: &EvmRpcProvider,
    ) -> Result<Self, AppError> {
        let address = Address::from_str(addr)?;
        let erc20_contract = Erc20Contract::new(address, client);

        let name = erc20_contract.name().call().await?._0;
        let symbol = erc20_contract.symbol().call().await?._0;
        let decimals = erc20_contract.decimals().call().await?._0;

        Ok(TokenInfo {
            chain,
            addr: addr.to_string(),
            name,
            symbol,
            decimals,
        })
    }
}
