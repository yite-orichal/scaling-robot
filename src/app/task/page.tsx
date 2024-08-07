"use client";

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Spinner,
  Tab,
  Tabs,
} from "@nextui-org/react";
import { useEffect, useRef, useState } from "react";
import * as win from "@tauri-apps/api/webviewWindow";
import {
  useRemoveTradeTaskCmd,
  useStartTradeTaskCmd,
  useStopTradeTaskCmd,
} from "@/hooks/tasks";
import { Event, UnlistenFn } from "@tauri-apps/api/event";
import _ from "lodash";
import dayjs from "dayjs";

type TradeTaskEventType = "Executed" | "Stopped";

type TradeTaskEventPayload = {
  task_id: string;
  worker_id?: number;
  kind: TradeTaskEventType;
  msg: string;
  ts: number;
};

const MAX_LOG_LEN = 1000;

export default function TaskPage() {
  const [stopping, setStopping] = useState(false);
  const [running, setRunning] = useState(false);
  const [_chain, setChain] = useState("");
  const [_walletGrpName, setWalletGrpName] = useState("");
  const [_walletGrpId, setWalletGrpId] = useState("");
  const [_tradeMode, setTradeMode] = useState("");
  const [_tokenSymbol, setTokenSymbol] = useState("");
  const [workerLogs, setWorkerLogs] = useState<
    Record<number, TradeTaskEventPayload[]>
  >([]);

  const { startTradeTask, starting, startTradeTaskErr } =
    useStartTradeTaskCmd();
  const { stopTradeTask, stopTradeTaskErr } = useStopTradeTaskCmd();
  const { removeTradeTask, removing, removeTradeTaskErr } =
    useRemoveTradeTaskCmd();

  const _startTask = async (taskId: string) => {
    try {
      await startTradeTask({ id: taskId });
      setRunning(true);
    } catch {
      // already use cmd error state
      setRunning(false);
    }
  };

  const _stopTask = async (taskId: string) => {
    setStopping(true);
    try {
      await stopTradeTask({ id: taskId });
    } catch {
      // catched by cmd
    } finally {
      // async stop finished by event
    }
  };

  const _removeTask = async (taskId: string) => {
    try {
      await removeTradeTask({ id: taskId });
      win.getCurrentWebviewWindow().close();
    } catch {}
  };

  useEffect(() => {
    async function init() {
      const searchParams = new URLSearchParams(location.search);
      const chain = searchParams.get("chain");
      const walletGrpName = searchParams.get("walletGrpName");
      const walletGrpId = searchParams.get("walletGrpId");
      const tradeMode = searchParams.get("tradeMode");
      const tokenSymbol = searchParams.get("tokenSymbol");

      setChain(chain || "");
      setTradeMode(tradeMode || "");
      setTokenSymbol(tokenSymbol || "");

      if (walletGrpName) {
        setWalletGrpName(walletGrpName);
      }

      let unlisten: Promise<UnlistenFn> | undefined;
      if (walletGrpId) {
        setWalletGrpId(walletGrpId);
        const w = win.getCurrentWebviewWindow();
        unlisten = w.listen(
          "trade_task_event",
          (data: Event<TradeTaskEventPayload>) => {
            let workerId = data.payload.worker_id;
            if (workerId === null || workerId === undefined) {
              if (data.payload.kind === "Stopped") {
                setStopping(false);
                setRunning(false);
              }
              return;
            }

            setWorkerLogs((old) => {
              const newRecord = { ...old };
              const workerLogs = newRecord[workerId];
              if (workerLogs) {
                let newItems = [...workerLogs, data.payload];
                if (newItems.length > MAX_LOG_LEN) {
                  newItems.splice(0, newItems.length - MAX_LOG_LEN);
                }
                newRecord[workerId] = newItems;
              } else {
                newRecord[workerId] = [data.payload];
              }
              return newRecord;
            });
          },
        );

        await _startTask(walletGrpId);
      }

      return unlisten;
    }

    const unlisten = init();
    return () => {
      unlisten.then((f) => f && f());
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <main className="px-3 pb-3 h-screen max-h-screen">
      <div className="flex flex-col gap-2 sticky top-0 py-3 z-50 bg-black">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-5">
            <div>Chain: {_chain}</div>
            <div className="font-bold">Wallet Group: {_walletGrpName}</div>
            <div>
              TradeMode:{" "}
              {_tradeMode.toLowerCase() === "both" ? "Buy / Sell" : _tradeMode}
            </div>
            <div className="font-bold"> Token: {_tokenSymbol}</div>
          </div>
          {running ? (
            <Button
              isLoading={stopping}
              color="warning"
              onClick={async () => _stopTask(_walletGrpId)}
            >
              {stopping ? "Stopping ..." : "Stop"}
            </Button>
          ) : (
            <Button
              isLoading={starting}
              color="primary"
              onClick={async () => _startTask(_walletGrpId)}
            >
              {starting ? "Starting ..." : "Start"}
            </Button>
          )}
          <Button
            color="danger"
            isDisabled={running || stopping}
            isLoading={removing}
            onClick={async () => await _removeTask(_walletGrpId)}
          >
            Close
          </Button>
        </div>
        {startTradeTaskErr && (
          <div className="text-red-500">{startTradeTaskErr.err_msg}</div>
        )}
        {stopTradeTaskErr && (
          <div className="text-red-500">{stopTradeTaskErr.err_msg}</div>
        )}
        {removeTradeTaskErr && (
          <div className="text-red-500">{removeTradeTaskErr.err_msg}</div>
        )}
      </div>
      <div>
        <Tabs
          isVertical={_.keys(workerLogs).length > 10}
          className="max-h-[calc(100vh-5rem)] overflow-y-auto scrollbar-hide"
        >
          {_.map(workerLogs, (logs, idx) => (
            <Tab
              key={idx}
              title={<div className="pr-3">{`Worker ${Number(idx) + 1}`}</div>}
              className="w-full pr-0"
            >
              <TradeLogPanel
                workerIdx={Number(idx)}
                logs={logs}
                isLoading={running || stopping}
              />
            </Tab>
          ))}
        </Tabs>
      </div>
    </main>
  );
}

function TradeLogPanel({
  workerIdx,
  logs,
  isLoading = false,
}: {
  workerIdx: number;
  logs: TradeTaskEventPayload[];
  isLoading: boolean;
}) {
  const scrolleDivRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrolleDivRef.current?.scroll(0, 9999999);
  }, [logs]);

  return (
    <Card className="h-[calc(100vh-5rem)] max-h-[calc(100vh-5rem)]">
      <CardHeader>
        <div className="font-bold">Worker {workerIdx + 1} Logs</div>
      </CardHeader>
      <CardBody className="h-full">
        <div
          className="top-0 bottom-0 left-0 right-0 overflow-scroll"
          ref={scrolleDivRef}
        >
          <div className="flex flex-col gap-0.5">
            {logs.map((log, idx) => {
              return (
                <pre key={idx} className="text-sm">
                  {log.msg.length > 0
                    ? dayjs(log.ts).format("YY-MM-DD HH:mm:ss")
                    : ""}{" "}
                  {log.msg}
                </pre>
              );
            })}
            {isLoading && (
              <div>
                <Spinner size="sm" />
              </div>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
