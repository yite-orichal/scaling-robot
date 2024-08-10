import { Chain, useCmd } from ".";

export type CreateWalletGrpReq = {
  id: string;
  name: string;
  cnt: number;
};

export type CreateWalletGrpResp = {
  id: string;
  name: string;
  chain: Chain;
  addresses: string[];
};

export type ImportWalletGrpReq = {
  id: string;
  name: string;
  pks: string[];
};

export type ExportWalletGrpReq = {
  /**
   * array item format [addr, pk]
   */
  pks: [string, string][];
  path: string;
};

export function useCreateWalletGrpCmd() {
  const {
    invokeFn: createWalletGrp,
    invoking: creating,
    result: walletGrp,
    error: createWalletGrpError,
  } = useCmd<CreateWalletGrpResp, { req: CreateWalletGrpReq }>(
    "create_wallet_grp",
  );

  return {
    createWalletGrp,
    creating,
    walletGrp,
    createWalletGrpError,
  };
}

export function useImportWalletGrpCmd() {
  const {
    invokeFn: importWalletGrp,
    invoking: importing,
    result: walletGrp,
    error: importWalletGrpError,
  } = useCmd<CreateWalletGrpResp, { req: ImportWalletGrpReq }>(
    "import_wallet_grp",
  );

  return {
    importWalletGrp,
    importing,
    walletGrp,
    importWalletGrpError,
  };
}

export function useExportWalletGrpCmd() {
  const {
    invokeFn: exportWalletGrp,
    invoking: exporting,
    error: exportWalletGrpError,
  } = useCmd<null, { req: ExportWalletGrpReq }>("export_wallet_grp");

  return {
    exportWalletGrp,
    exporting,
    exportWalletGrpError,
  };
}

export type WalletGrpWithdrawReq = {
  chain: Chain;
  from_pk: string;
  addr: string;
};

export function useWalletWithdrawCmd() {
  const {
    invokeFn: withdraw,
    invoking: withdrawing,
    result: txId,
    error: withdrawError,
  } = useCmd<string, { req: WalletGrpWithdrawReq }>("wallet_grp_withdraw");

  return {
    withdraw,
    withdrawing,
    txId,
    withdrawError,
  };
}
