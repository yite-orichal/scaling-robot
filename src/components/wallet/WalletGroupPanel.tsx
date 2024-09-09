import {
  useDeleteWalletGrpCmd,
  useExportWalletGrpCmd,
  WalletGrpResp,
} from "@/hooks";
import { AddrBalanceResp, useGetAddrBalanceCmd } from "@/hooks/chain";
import { Card, CardBody, CardHeader } from "@nextui-org/react";
import * as path from "@tauri-apps/api/path";
import * as dialog from "@tauri-apps/plugin-dialog";
import _ from "lodash";
import { useCallback, useEffect, useState } from "react";
import { AiOutlineDelete, AiOutlineExport } from "react-icons/ai";
import { MdOutlineMerge, MdRefresh } from "react-icons/md";
import { TbArrowFork } from "react-icons/tb";
import IconButton from "../IconButton";
import { useProject } from "../project/Provider";
import AirdropModal from "./AirdropModal";
import BatchWithDrawModal from "./BatchWithdrawModal";
import toast from "react-hot-toast";
import { sleep } from "@/app/utils";

export default function WalletGroupPanel({
  isRunning = false,
  walletGrp,
  onWalletGroupDeleted,
}: {
  isRunning: boolean;
  walletGrp: WalletGrpResp;
  onWalletGroupDeleted: (id: string) => void;
}) {
  const [isAirdropModalOpen, setIsAirdropModalOpen] = useState(false);
  const [isBatchWithdrawModalOpen, setIsBatchWithdrawModalOpen] =
    useState(false);
  const { getAddrBalance } = useGetAddrBalanceCmd();
  const [isGettingBal, setIsGettingBal] = useState(false);
  const [addrBalances, setAddrBalances] = useState<
    Record<string, AddrBalanceResp>
  >({});

  const { project, nativeCoinSymbol, refreshMainWalletBalance } = useProject();
  const { exportWalletGrp } = useExportWalletGrpCmd();
  const { delWalletGrp } = useDeleteWalletGrpCmd();

  const onExportWalletGrp = async () => {
    let docPath = await path.documentDir();
    let defaultPath = await path.join(
      docPath,
      `${project.name}_${walletGrp.name}_wallets.txt`,
    );

    const savePath = await dialog.save({
      title: "Save Wallet Group File",
      defaultPath,
    });
    if (!savePath) return;

    try {
      await exportWalletGrp({
        req: { path: savePath, pks: walletGrp.addresses },
      });
      toast.success(`Export wallet group successed`);
    } catch (e) {
      let err = e as { err_msg: string };
      toast.error(`Export wallet group error: ${err.err_msg}`);
    }
  };

  const refreshBalances = useCallback(
    async (force: boolean = false) => {
      setIsGettingBal(true);
      try {
        const addrChunks = _.chunk(walletGrp.addresses, 30);
        for (const chunk of addrChunks) {
          const promises = chunk.map(([addr, _]) => {
            const cached = addrBalances[addr];
            return cached === undefined || force
              ? getAddrBalance({ chain: walletGrp.chain, addr })
              : Promise.resolve(cached);
          });
          const resps = await Promise.all(promises);
          setAddrBalances((old) => {
            const newResult = { ...old };
            for (const resp of resps) {
              newResult[resp.addr] = resp;
            }
            return newResult;
          });
          await sleep(200);
        }
      } catch (err) {
        const err_msg = (err as any).err_msg || `${err}`;
        toast.error(`refresh address balance error: ${err_msg}`);
      } finally {
        setIsGettingBal(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [walletGrp],
  );

  const onDelWalletGrp = async () => {
    let isOk = await dialog.confirm("are you sure?", {
      kind: "warning",
      title: "Confirm Delete Wallet Group",
    });
    if (!isOk) {
      return;
    }

    try {
      await delWalletGrp({ grp_id: walletGrp.id });
      onWalletGroupDeleted(walletGrp.id);
    } catch (err) {
      const e = err as { err_msg: string };
      toast.error(`delete wallet group error: ${e.err_msg}`);
    }
  };

  useEffect(() => {
    refreshBalances();
    return () => {
      // if from isRunning exit, refresh balance
      if (isRunning) {
        refreshBalances(true);
      }
    };
  }, [isRunning, refreshBalances]);

  return (
    <>
      <Card
        className="flex-1 min-h-full max-h-full"
        classNames={{ body: "pt-1" }}
      >
        <CardHeader>
          <div className="w-full flex items-center gap-3">
            <div>
              {walletGrp.name} ({walletGrp.addresses.length} items)
            </div>
            <div className="flex-1 flex items-center justify-end gap-3">
              <IconButton
                tooltip={
                  isRunning
                    ? "Stop running task to delete wallet group"
                    : "Delete Wallet Group"
                }
                Icon={AiOutlineDelete}
                isDanger
                isDisabled={isRunning}
                onClick={onDelWalletGrp}
              />
              <IconButton
                tooltip={"Export Wallet Group"}
                Icon={AiOutlineExport}
                onClick={onExportWalletGrp}
              />
              <IconButton
                tooltip={"Refresh balance"}
                Icon={MdRefresh}
                isDisabled={isGettingBal}
                iconClassName={isGettingBal ? "animate-spin" : ""}
                onClick={() => refreshBalances(true)}
              />
              <IconButton
                tooltip={"Deposit from main wallet"}
                Icon={TbArrowFork}
                rotate180
                onClick={() => setIsAirdropModalOpen(true)}
              />
              <IconButton
                tooltip={"Withdraw to main wallet"}
                Icon={MdOutlineMerge}
                iconClassName="scale-125"
                onClick={() => setIsBatchWithdrawModalOpen(true)}
              />
              {/* <div> */}
              {/*   <IoTrashOutline /> */}
              {/* </div> */}
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <div className="flex flex-col space-y-0.5 min-h-full max-h-full">
            {walletGrp.addresses.map(([addr, _], idx) => {
              const uiAmount = addrBalances[addr]?.bal_ui;
              const displayAmount = uiAmount
                ? Number(uiAmount).toFixed(9)
                : "0";
              return (
                <div key={idx} className="text-sm flex items-center gap-3">
                  <div className="w-14 text-right"># {idx + 1}</div>
                  <div>{addr}</div>
                  <div className="text-right flex-grow">
                    {`${displayAmount} ${nativeCoinSymbol}`}
                  </div>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>
      {isAirdropModalOpen && (
        <AirdropModal
          walletGrp={walletGrp}
          isOpen={isAirdropModalOpen}
          onOpenChange={(isOpen) => {
            setIsAirdropModalOpen(isOpen);
            refreshMainWalletBalance();
            refreshBalances(true);
          }}
        />
      )}
      {isBatchWithdrawModalOpen && (
        <BatchWithDrawModal
          walletGrp={walletGrp}
          isOpen={isBatchWithdrawModalOpen}
          onOpenChange={(isOpen) => {
            setIsBatchWithdrawModalOpen(isOpen);
            refreshMainWalletBalance();
            refreshBalances(true);
          }}
        />
      )}
    </>
  );
}
