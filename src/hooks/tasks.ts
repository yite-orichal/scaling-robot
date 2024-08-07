import { useCmd } from ".";
import { TokenInfo } from "./chain";

export type TradeMode = "Both" | "BuyOnly" | "SellOnly";

export type CreateTaskReq = {
  workers_cnt: number;
  wallet_grp_id: string;
  token: TokenInfo;
  trade_mode: TradeMode;
  percetage: [number, number];
  slippage: number;
  gas_price: number;
  interval_secs: number;
};

export function useCreateTradeTaskCmd() {
  const {
    invokeFn: createTradeTask,
    invoking: creating,
    error: createTradeTaskErr,
  } = useCmd<null, { req: CreateTaskReq }>("create_trade_task", null);

  return {
    createTradeTask,
    creating,
    createTradeTaskErr,
  };
}

export function useStartTradeTaskCmd() {
  const {
    invokeFn: startTradeTask,
    invoking: starting,
    error: startTradeTaskErr,
  } = useCmd<null, { id: string }>("start_trade_task", null);

  return {
    startTradeTask,
    starting,
    startTradeTaskErr,
  };
}

export function useStopTradeTaskCmd() {
  const {
    invokeFn: stopTradeTask,
    invoking: stopping,
    error: stopTradeTaskErr,
  } = useCmd<null, { id: string }>("stop_trade_task", null);

  return {
    stopTradeTask,
    stopping,
    stopTradeTaskErr,
  };
}

export function useRemoveTradeTaskCmd() {
  const {
    invokeFn: removeTradeTask,
    invoking: removing,
    error: removeTradeTaskErr,
  } = useCmd<null, { id: string }>("remove_trade_task", null);

  return {
    removeTradeTask,
    removing,
    removeTradeTaskErr,
  };
}
