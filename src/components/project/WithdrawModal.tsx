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
import FormItem from "../FormItem";
import TextInput from "../TextInput";
import { Controller, useForm } from "react-hook-form";
import { NumericFormat } from "react-number-format";
import { useTransferNativeCmd } from "@/hooks/chain";
import { useProject } from "./Provider";
import * as shell from "@tauri-apps/plugin-shell";
import { abbr } from "@/app/utils";
import {
  BASE_TX_FAKE_BASE_FEE,
  BSC_TX_FAKE_BASE_FEE,
  SOL_TX_BASE_FEE,
} from "@/consts";
import { Chain } from "@/hooks";

function get_tx_base_fee(chain: Chain): number {
  if (chain === "Solana") {
    return SOL_TX_BASE_FEE;
  }
  if (chain === "Base") {
    return BASE_TX_FAKE_BASE_FEE;
  }
  if (chain === "Bsc") {
    return BSC_TX_FAKE_BASE_FEE;
  }
  return 0;
}

type FormData = { to_addr: string; amount: string };
export default function MainWalletWithdrawModal({
  balance,
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean;
  balance: number;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({});

  const { transferNative, txId, transfering, transferNativeError } =
    useTransferNativeCmd();
  const { project, nativeCoinSymbol, explorerBaseUrl } = useProject();

  const onFormSubmit = async (data: FormData) => {
    try {
      await transferNative({
        req: {
          chain: project.chain,
          from_pk: project.main_wallet_pk,
          addr: data.to_addr,
          amount: data.amount,
        },
      });
    } catch {
      // already catched by cmd
    }
  };

  const labelClassName = "text-right w-28";
  return (
    <Modal
      isOpen={isOpen}
      isDismissable={false}
      onOpenChange={onOpenChange}
      size="3xl"
      hideCloseButton={transfering}
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader>Main Wallet Withdraw</ModalHeader>
            <ModalBody>
              <div className="flex flex-col gap-3">
                <form className="flex flex-col gap-3">
                  <FormItem label={<div className={labelClassName}>From</div>}>
                    <div>{project.main_wallet}</div>
                  </FormItem>
                  <FormItem
                    label={<div className={labelClassName}>To Address</div>}
                    error={errors.to_addr}
                  >
                    <TextInput
                      autoFocus
                      {...register("to_addr", {
                        required: {
                          value: true,
                          message: "To Address Required",
                        },
                      })}
                    />
                  </FormItem>
                  <FormItem
                    label={<div className={labelClassName}>Amount</div>}
                    error={errors.amount}
                  >
                    <Controller
                      control={control}
                      name="amount"
                      rules={{
                        required: { value: true, message: "Amount required" },
                        min: {
                          value: 0.000000001,
                          message: "must larger than 0.000000001",
                        },
                      }}
                      render={({ field }) => {
                        return (
                          <NumericFormat
                            thousandSeparator
                            decimalScale={9}
                            allowNegative={false}
                            customInput={Input}
                            endContent={
                              <div className="flex items-center gap-2">
                                <span className="text-default-400">
                                  {nativeCoinSymbol}
                                </span>
                                <Button
                                  size="sm"
                                  className="px-2 min-w-8 h-6"
                                  onClick={() => {
                                    const amount =
                                      balance - get_tx_base_fee(project.chain);

                                    field.onChange(amount.toString());
                                  }}
                                >
                                  Max
                                </Button>
                              </div>
                            }
                            value={field.value}
                            onValueChange={(v) => field.onChange(v.value)}
                          />
                        );
                      }}
                    />
                  </FormItem>
                </form>
                {txId && (
                  <div className="flex items-center gap-3">
                    <span>Withdraw successed: </span>
                    <Link
                      href="#"
                      onClick={() => {
                        shell.open(`${explorerBaseUrl}/tx/${txId}`);
                        return false;
                      }}
                    >
                      {abbr(txId, 20)}
                    </Link>
                  </div>
                )}
                {transferNativeError && (
                  <div className="flex items-center gap-3">
                    <span>Withdraw Failed:</span>
                    <span className="text-danger">
                      ${transferNativeError.err_msg}
                    </span>
                  </div>
                )}
              </div>
            </ModalBody>
            <ModalFooter>
              <Button isDisabled={transfering} onClick={onClose}>
                Cancel
              </Button>
              <Button
                isLoading={transfering}
                color="primary"
                onClick={() => handleSubmit(onFormSubmit)()}
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
