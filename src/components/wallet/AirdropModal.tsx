import { abbr } from "@/app/utils";
import { WalletGrpResp } from "@/hooks";
import { useAirdropCmd } from "@/hooks/chain";
import {
  Button,
  Input,
  Link,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@nextui-org/react";
import * as shell from "@tauri-apps/plugin-shell";
import _ from "lodash";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { NumericFormat } from "react-number-format";
import FormItem from "../FormItem";
import { useProject } from "../project/Provider";

type FormData = { per_amount: number };

export default function AirdropModal({
  walletGrp,
  isOpen,
  onOpenChange,
}: {
  walletGrp: WalletGrpResp;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const { project, nativeCoinSymbol, explorerBaseUrl } = useProject();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: { per_amount: 0.02 },
  });

  const { airdrop } = useAirdropCmd();
  const [depositing, setDepositing] = useState(false);
  const [depositLogs, setDepositLogs] = useState<
    { isError: boolean; msg: string }[]
  >([]);

  const onFormSubmit = async (data: FormData) => {
    const chunkSize =
      walletGrp.chain === "Solana" ? 20 : walletGrp.addresses.length;
    const addrChunks = _.chunk(walletGrp.addresses, chunkSize);

    setDepositing(true);
    for (const addr_and_pks of addrChunks) {
      try {
        let addrs = addr_and_pks.map((it) => it[0]);
        const txId = await airdrop({
          req: {
            chain: project.chain,
            from_pk: project.main_wallet_pk,
            addrs,
            per_amount: data.per_amount,
          },
        });
        setDepositLogs((old) => [...old, { isError: false, msg: txId }]);
      } catch (err) {
        const e = err as { err_msg: string };
        setDepositLogs((old) => [...old, { isError: true, msg: e.err_msg }]);
      }
    }
    setDepositing(false);
  };

  const labelClassName = "w-36 text-right";

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="3xl"
      isDismissable={false}
      hideCloseButton={depositing}
    >
      <ModalContent>
        {(onClose) => {
          return (
            <>
              <ModalHeader>Deposit</ModalHeader>
              <ModalBody>
                <form className="flex flex-col gap-3">
                  <FormItem
                    label={<div className={labelClassName}>From Wallet</div>}
                  >
                    {project.main_wallet}
                  </FormItem>
                  <FormItem
                    label={
                      <div className={labelClassName}>To Wallet Group</div>
                    }
                  >
                    {walletGrp.name} ({walletGrp.addresses.length} addresses)
                  </FormItem>
                  <FormItem
                    label={
                      <div className={labelClassName}>Per Wallet Amount</div>
                    }
                    error={errors.per_amount}
                  >
                    <Controller
                      control={control}
                      name="per_amount"
                      rules={{
                        required: { value: true, message: "Amount required" },
                        min: {
                          value: 0.000001,
                          message: "must larger than 0.000001",
                        },
                      }}
                      render={({ field }) => {
                        return (
                          <NumericFormat
                            autoFocus
                            thousandSeparator
                            decimalScale={6}
                            allowNegative={false}
                            customInput={Input}
                            endContent={
                              <span className="text-default-400">
                                {nativeCoinSymbol}
                              </span>
                            }
                            value={field.value}
                            onValueChange={(v) => field.onChange(v.value)}
                          />
                        );
                      }}
                    />
                  </FormItem>
                  {depositLogs.length > 0 && (
                    <div className="flex flex-col gap-1">
                      {depositLogs.map((item, idx) => {
                        return (
                          <div key={idx}>
                            {item.isError ? (
                              <div className="text-danger">{item.msg}</div>
                            ) : (
                              <Link
                                href="#"
                                onClick={() => {
                                  shell.open(
                                    `${explorerBaseUrl}/tx/${item.msg}`,
                                  );
                                  return false;
                                }}
                              >
                                {abbr(item.msg, 20)}
                              </Link>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </form>
              </ModalBody>
              <ModalFooter>
                <Button isDisabled={depositing} onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  color="primary"
                  isLoading={depositing}
                  onClick={() => handleSubmit(onFormSubmit)()}
                >
                  Deposit
                </Button>
              </ModalFooter>
            </>
          );
        }}
      </ModalContent>
    </Modal>
  );
}
