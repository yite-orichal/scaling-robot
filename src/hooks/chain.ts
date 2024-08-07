import { useCmd } from ".";
import { Chain } from "./project";

export type AddrBalanceResp = {
  addr: string;
  bal_ui: string;
  bal: string;
};

export type TokenInfo = {
  chain: Chain;
  addr: string;
  name: string;
  symbol: string;
  decimals: number;
};

export function useGetAddrBalanceCmd() {
  const {
    invokeFn: getAddrBalance,
    invoking: getting,
    result: balance,
    error: getAddrBalanceError,
  } = useCmd<AddrBalanceResp, { chain: Chain; addr: string }>(
    "get_addr_balance",
  );

  return {
    getAddrBalance,
    getting,
    balance,
    getAddrBalanceError,
  };
}

export function useGetTokenInfoCmd(defaultVal?: TokenInfo) {
  const {
    invokeFn: getTokenInfo,
    invoking: getting,
    result: tokenInfo,
    setResult: setTokenInfo,
    error: getTokenInfoError,
  } = useCmd<TokenInfo, { chain: Chain; addr: string }>(
    "get_token_info",
    defaultVal,
  );

  return {
    getTokenInfo,
    getting,
    tokenInfo,
    setTokenInfo,
    getTokenInfoError,
  };
}

export type AirdropReq = {
  chain: Chain;
  from_pk: string;
  addrs: string[];
  per_amount: number;
};

export function useAirdropCmd() {
  const {
    invokeFn: airdrop,
    invoking: airdroping,
    result: txId,
    error: airdropError,
  } = useCmd<string, { req: AirdropReq }>("airdrop");

  return {
    airdrop,
    airdroping,
    txId,
    airdropError,
  };
}

export type TransferNativeReq = {
  chain: Chain;
  from_pk: string;
  addr: string;
  /**
   * 'max' or float number
   */
  amount: string;
};

export function useTransferNativeCmd() {
  const {
    invokeFn: transferNative,
    invoking: transfering,
    result: txId,
    error: transferNativeError,
  } = useCmd<string, { req: TransferNativeReq }>("transfer_native");

  return {
    transferNative,
    transfering,
    txId,
    transferNativeError,
  };
}
