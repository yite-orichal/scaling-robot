use alloy::primitives::{address, Address};
use solana_sdk::{pubkey, pubkey::Pubkey};

#[allow(unused)]
pub const SOL_TX_BASE_FEE: u64 = 5_000;
pub const WSOL_MINT: Pubkey = pubkey!("So11111111111111111111111111111111111111112");

pub const BASE_MOO_TOKEN_HUB_ADDR: Address = address!("2592342f0c6c54ac61876d30358d4c944bb4ce54");
pub const BASE_WETH_ADDR: Address = address!("4200000000000000000000000000000000000006");
pub const BASE_ONE_INCH_V6_ROUTER_ADDR: Address =
    address!("111111125421cA6dc452d289314280a0f8842A65");

pub const BSC_MOO_TOKEN_HUB_ADDR: Address = address!("26cf96267bd73E98aF0e360c3B6157573f40001D");
pub const BSC_WBNB_ADDR: Address = address!("bb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c");
pub const BSC_ONE_INCH_V6_ROUTER_ADDR: Address =
    address!("111111125421cA6dc452d289314280a0f8842A65");

pub const ONE_INCH_NATIVE_COIN_ADDR: Address = address!("eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee");
