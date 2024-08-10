use alloy::sol;

sol!(
    #[sol(rpc)]
    WEthContract,
    "abis/weth.json"
);

sol!(
    #[sol(rpc)]
    Erc20Contract,
    "abis/erc20.json"
);

sol!(
    #[sol(rpc)]
    MooTokenHubContract,
    "abis/moo_token_hub.json"
);
