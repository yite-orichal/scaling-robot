import { WalletGrpResp } from "@/hooks";
import {
  Button,
  Link,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@nextui-org/react";
import { useProject } from "../project/Provider";
import FormItem from "../FormItem";
import { useTransferNativeCmd } from "@/hooks/chain";
import { useState } from "react";
import * as shell from "@tauri-apps/plugin-shell";
import _ from "lodash";
import { abbr } from "@/app/utils";

export default function BatchWithDrawModal({
  walletGrp,
  isOpen,
  onOpenChange,
}: {
  walletGrp: WalletGrpResp;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const { project, explorerBaseUrl } = useProject();

  const [transferLogs, setTransferLogs] = useState<
    { addr: string; log: string; isError: boolean }[]
  >([]);
  const [isTransfering, setIsTransfering] = useState(false);
  const { transferNative } = useTransferNativeCmd();

  const transfer = async () => {
    const pkChunks = _.chain(walletGrp.addresses).chunk(20).value();

    setIsTransfering(true);
    for (const pkChunk of pkChunks) {
      let promises = pkChunk.map(async ([addr, pk]) => {
        try {
          let txid = await transferNative({
            req: {
              chain: walletGrp.chain,
              from_pk: pk,
              addr: project.main_wallet,
              amount: "max",
            },
          });
          setTransferLogs((old) => {
            return [...old, { addr, log: txid, isError: false }];
          });
        } catch (e) {
          const err = e as { err_msg: string };
          const err_msg = `${err.err_msg}`;
          setTransferLogs((old) => {
            return [...old, { addr, log: err_msg, isError: true }];
          });
        }
      });

      await Promise.all(promises);
    }
    setIsTransfering(false);
  };

  const labelClassName = "text-right w-28";
  return (
    <Modal
      isDismissable={false}
      size="4xl"
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      hideCloseButton={isTransfering}
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader>Wallet Group Withdraw</ModalHeader>
            <ModalBody>
              <div className="flex flex-col gap-3">
                <form className="flex flex-col gap-2">
                  <FormItem label={<div className={labelClassName}>From</div>}>
                    <div>
                      {walletGrp.name} ({walletGrp.addresses.length} addresses)
                    </div>
                  </FormItem>
                  <FormItem label={<div className={labelClassName}>To</div>}>
                    <div>{project.main_wallet}</div>
                  </FormItem>
                  <FormItem label={<div className={labelClassName}>Value</div>}>
                    <div>Maximum</div>
                  </FormItem>
                </form>
                {transferLogs.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <div className="font-bold">Results</div>
                    <div className="max-h-72 overflow-y-auto">
                      {transferLogs.map((l, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div className="w-48">{abbr(l.addr, 8)}</div>
                          <div className={l.isError ? "text-danger" : ""}>
                            {l.isError ? (
                              l.log
                            ) : (
                              <Link
                                href="#"
                                onClick={() => {
                                  shell.open(`${explorerBaseUrl}/tx/${l.log}`);
                                  return false;
                                }}
                              >
                                {abbr(l.log, 20)}
                              </Link>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ModalBody>
            <ModalFooter>
              <Button isDisabled={isTransfering} onClick={onClose}>
                Close
              </Button>
              <Button
                isLoading={isTransfering}
                color="primary"
                onClick={transfer}
              >
                Withdraw
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
