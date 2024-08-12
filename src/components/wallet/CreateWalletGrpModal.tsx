import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@nextui-org/react";
import FormItem from "../FormItem";
import TextInput from "../TextInput";
import { NumericFormat } from "react-number-format";
import { Controller, useForm } from "react-hook-form";
import {
  CreateWalletGrpResp,
  useCreateWalletGrpCmd,
  useImportWalletGrpCmd,
} from "@/hooks";
import FileSelector from "../FileSelector";
import * as fs from "@tauri-apps/plugin-fs";

type FormDataType = {
  id: string;
  name: string;
  cnt: number;
  pks: string[];
};

export default function CreateWalletGrpModal({
  isOpen,
  isImport = false,
  onOpenChange,
  onWalletGrpCreated,
}: {
  isOpen: boolean;
  isImport: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onWalletGrpCreated: (grp: CreateWalletGrpResp) => void;
}) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormDataType>({
    defaultValues: { cnt: 100, pks: [] },
  });

  const { createWalletGrp, creating, createWalletGrpError } =
    useCreateWalletGrpCmd();

  const { importWalletGrp, importing, importWalletGrpError } =
    useImportWalletGrpCmd();

  async function createGrp(data: FormDataType) {
    const id = window.crypto.randomUUID();
    let grp;
    if (isImport) {
      grp = await importWalletGrp({
        req: {
          id,
          name: data.name,
          pks: data.pks,
        },
      });
    } else {
      grp = await createWalletGrp({
        req: { id, name: data.name, cnt: Number(data.cnt) },
      });
    }
    if (grp) {
      onWalletGrpCreated(grp);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size={isImport ? "3xl" : "xl"}
      isDismissable={false}
      hideCloseButton={creating || importing}
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader>
              {isImport ? "Import" : "Create"} Wallet Group
            </ModalHeader>
            <ModalBody>
              <div className="flex flex-col gap-3">
                <form className="flex flex-col gap-3">
                  <FormItem
                    label={<div className="w-32 text-right">Name</div>}
                    error={errors?.name}
                  >
                    <TextInput
                      {...register("name", {
                        required: { value: true, message: "Name required" },
                        minLength: {
                          value: 3,
                          message: "At least 3 characters",
                        },
                      })}
                      aria-label="Name"
                      placeholder="Wallet Group Name"
                      autoFocus
                    />
                  </FormItem>
                  {isImport ? (
                    <Controller
                      control={control}
                      name="pks"
                      rules={{
                        required: { value: true, message: "Wallet Required" },
                        minLength: {
                          value: 1,
                          message: "At least one wallet needed",
                        },
                      }}
                      render={({ field }) => {
                        return (
                          <FormItem
                            label={
                              <div className="w-32 text-right">Wallet File</div>
                            }
                          >
                            <FileSelector
                              placeholder="Select a wallet group file"
                              onChange={async (filePath) => {
                                const fileLines =
                                  await fs.readTextFile(filePath);
                                const lines = fileLines
                                  .split("\n")
                                  .map((it) => {
                                    let pk = it.trim().split(",")[1];
                                    return pk ? pk.trim() : "";
                                  })
                                  .filter((it) => it.length > 0);
                                field.onChange(lines);
                              }}
                            />
                          </FormItem>
                        );
                      }}
                    />
                  ) : (
                    <FormItem
                      label={
                        <div className="w-32 text-right">Wallet Count</div>
                      }
                      error={errors.cnt}
                    >
                      <Controller
                        control={control}
                        name="cnt"
                        rules={{
                          required: {
                            value: true,
                            message: "Wallet Count required",
                          },
                          min: {
                            value: 1,
                            message: "At least create one wallet",
                          },
                          max: {
                            value: 10_000,
                            message: "At most create 10,000 wallet",
                          },
                        }}
                        render={({ field }) => {
                          return (
                            <NumericFormat
                              aria-label="Wallet Count"
                              customInput={Input}
                              decimalScale={0}
                              thousandSeparator
                              value={field.value}
                              onValueChange={(v) => field.onChange(v.value)}
                            />
                          );
                        }}
                      />
                    </FormItem>
                  )}
                </form>
                {createWalletGrpError && (
                  <div className="text-red-500 text-sm">
                    {createWalletGrpError.err_msg}
                  </div>
                )}
                {importWalletGrpError && (
                  <div className="text-red-500 text-sm">
                    {importWalletGrpError.err_msg}
                  </div>
                )}
              </div>
            </ModalBody>
            <ModalFooter>
              <Button isDisabled={creating || importing} onClick={onClose}>
                Cancel
              </Button>
              <Button
                isLoading={creating || importing}
                color="primary"
                onClick={() => handleSubmit(createGrp)()}
              >
                {isImport ? "Import" : "Create"}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
