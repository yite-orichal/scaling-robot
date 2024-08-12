import { VALID_URL_PATTERN } from "@/consts";
import { CreateProjectReq, useCreateProjectCmd } from "@/hooks";
import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
} from "@nextui-org/react";
import * as path from "@tauri-apps/api/path";
import * as dialog from "@tauri-apps/plugin-dialog";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import FormItem from "../FormItem";
import ProxyEditor from "../ProxyEditor";
import ProxyEditorTooltip from "../ProxyEditorTooltip";
import TextInput from "../TextInput";

export default function CreateProjectModal({
  isOpen,
  onOpenChange,
  onSaved,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSaved: (path: string) => void;
}) {
  const {
    register,
    control,
    watch,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateProjectReq>({
    defaultValues: { chain: "Solana", proxy_urls: [] },
  });

  const labelClassName = "w-32 text-right";
  const { createProject, creating, createProjectErr } = useCreateProjectCmd();

  async function onSubmitForm(data: CreateProjectReq) {
    let docPath = await path.documentDir();
    let defaultPath = await path.join(docPath, `${data.name}.maproj`);

    const savePath = await dialog.save({
      title: "Save Project File",
      defaultPath,
    });
    if (!savePath) return;

    data.id = window.crypto.randomUUID();
    data.save_path = savePath;

    await createProject({ req: data });
    onSaved(data.save_path);
  }

  const selectedChain = watch("chain");

  const aggApiUrlLabel = useMemo(() => {
    if (selectedChain === "Solana") {
      return "Jupiter Api Url";
    }

    return "1inch Api Url";
  }, [selectedChain]);

  return (
    <Modal
      isDismissable={false}
      size="5xl"
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      hideCloseButton={creating}
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader>Create Project</ModalHeader>
            <ModalBody>
              <div className="flex flex-col gap-3">
                <form className="flex flex-col gap-3">
                  <FormItem
                    label={<div className={labelClassName}>Name</div>}
                    error={errors?.name}
                  >
                    <TextInput
                      autoFocus
                      aria-label="Name"
                      placeholder="Project name"
                      {...register("name", {
                        required: {
                          value: true,
                          message: "Project name required",
                        },
                      })}
                    />
                  </FormItem>
                  <FormItem
                    label={<div className={labelClassName}>Chain</div>}
                    error={errors.chain}
                  >
                    <Select aria-label="Chain" {...register("chain")}>
                      <SelectItem key="Solana">Solana</SelectItem>
                      <SelectItem key="Base">Base</SelectItem>
                    </Select>
                  </FormItem>
                  <FormItem
                    label={<div className={labelClassName}>Rpc</div>}
                    error={errors.rpc}
                  >
                    <TextInput
                      aria-label="Rpc"
                      placeholder="Rpc Endpoint"
                      {...register("rpc", {
                        required: {
                          value: true,
                          message: "Rpc endpoint needed",
                        },
                        pattern: {
                          value: VALID_URL_PATTERN,
                          message: "Not a valid url",
                        },
                      })}
                    />
                  </FormItem>
                  <FormItem
                    label={
                      <div className={labelClassName}>{aggApiUrlLabel}</div>
                    }
                    error={errors.agg_api_url}
                  >
                    <TextInput
                      aria-label="Aggregation Api Url"
                      placeholder={aggApiUrlLabel}
                      {...register("agg_api_url", {
                        required: {
                          value: true,
                          message: "Aggregation Api Url needed",
                        },
                        pattern: {
                          value: VALID_URL_PATTERN,
                          message: "Not a valid url",
                        },
                      })}
                    />
                  </FormItem>
                  {selectedChain === "Base" && (
                    <FormItem
                      label={
                        <div className={labelClassName}>1inch Api Key</div>
                      }
                      error={errors.agg_api_key}
                    >
                      <TextInput
                        aria-label="Aggregation Api Key"
                        placeholder="1inch Api Key"
                        {...register("agg_api_key", {})}
                      />
                    </FormItem>
                  )}
                  <Controller
                    control={control}
                    name="proxy_urls"
                    rules={{
                      required: { value: true, message: "Proxy Required" },
                      minLength: {
                        value: 1,
                        message: "At least one proxy needed",
                      },
                    }}
                    render={({ field }) => {
                      return (
                        <div className="flex flex-col gap-3">
                          <FormItem
                            label={
                              <div
                                className={`${labelClassName} flex gap-1 items-center justify-end`}
                              >
                                <div>Proxy</div>
                                <ProxyEditorTooltip />
                              </div>
                            }
                            error={errors.proxy_urls}
                          >
                            <ProxyEditor
                              value={field.value}
                              onChange={(lines) =>
                                field.onChange(
                                  lines.filter((it) => it.trim().length > 0),
                                )
                              }
                            />
                          </FormItem>
                        </div>
                      );
                    }}
                  />
                </form>

                {createProjectErr && (
                  <div className="text-red-500 text-sm">
                    {createProjectErr.err_msg}
                  </div>
                )}
              </div>
            </ModalBody>
            <ModalFooter>
              <Button isDisabled={creating} onPress={onClose}>
                Cancel
              </Button>
              <Button
                color="primary"
                isLoading={creating}
                onPress={() => handleSubmit(onSubmitForm)()}
              >
                Save
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
