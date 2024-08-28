import { JITO_BLOCK_ENGINE_URLS, VALID_URL_PATTERN } from "@/consts";
import { ProjectResp, UpdateProjectReq, useUpdateProjectCmd } from "@/hooks";
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
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import FormItem from "../FormItem";
import ProxyEditor from "../ProxyEditor";
import TextInput from "../TextInput";
import { useProject } from "./Provider";
import ProxyEditorTooltip from "../ProxyEditorTooltip";

export default function EditProjectModal({
  isOpen,
  onOpenChange,
  onSaved,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSaved: (project: ProjectResp) => void;
}) {
  const { project } = useProject();
  const aggApiUrlLabel = useMemo(() => {
    if (project.chain === "Solana") {
      return "Jupiter Api Url";
    }
    return "1inch Api Url";
  }, [project]);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<UpdateProjectReq>({
    defaultValues: {
      rpc_url: project.rpc,
      jito_url: project.jito_url,
      proxy_urls: project.proxy_urls,
      agg_api_url: project.agg_api_url,
      agg_api_key: project.agg_api_key,
      main_wallet_pk: project.main_wallet_pk,
    },
  });

  const labelClassName = "w-36 text-right";

  const { updateProject, updating } = useUpdateProjectCmd();

  const onFormSubmit = async (data: UpdateProjectReq) => {
    try {
      const resp = await updateProject({ req: data });
      onSaved(resp);
    } catch (e) {
      const err = e as { err_msg: string };
      toast.error(`update project error: ${err.err_msg}`);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="5xl"
      isDismissable={false}
      hideCloseButton={updating}
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader>Update Project</ModalHeader>
            <ModalBody>
              <div>
                <form className="flex flex-col gap-3">
                  <FormItem
                    label={<div className={labelClassName}>Main Wallet</div>}
                    error={errors.main_wallet_pk}
                  >
                    <TextInput
                      autoFocus
                      placeholder="Main Wallet Private Key"
                      {...register("main_wallet_pk", {
                        required: {
                          value: true,
                          message: "Main Wallet Required",
                        },
                      })}
                    />
                  </FormItem>
                  <FormItem
                    label={<div className={labelClassName}>Rpc Url</div>}
                    error={errors.rpc_url}
                  >
                    <TextInput
                      placeholder="Rpc Url"
                      {...register("rpc_url", {
                        required: {
                          value: true,
                          message: "Rpc Url Required",
                        },
                        pattern: {
                          value: VALID_URL_PATTERN,
                          message: "Not a valid url",
                        },
                      })}
                    />
                  </FormItem>
                  {project.chain === "Solana" && (
                    <FormItem
                      label={<div className={labelClassName}>Jito Api Url</div>}
                      error={errors.jito_url}
                    >
                      <Select
                        aria-label="Jito Api Url"
                        {...register("jito_url")}
                      >
                        {JITO_BLOCK_ENGINE_URLS.map((item) => (
                          <SelectItem key={item.value}>{item.name}</SelectItem>
                        ))}
                      </Select>
                    </FormItem>
                  )}

                  <FormItem
                    label={
                      <div className={labelClassName}>{aggApiUrlLabel}</div>
                    }
                    error={errors.agg_api_url}
                  >
                    <TextInput
                      aria-label="Aggreation Api Url"
                      placeholder={aggApiUrlLabel}
                      {...register("agg_api_url", {
                        required: {
                          value: true,
                          message: "Aggreation Api Url Required",
                        },
                        pattern: {
                          value: VALID_URL_PATTERN,
                          message: "Not a valid url",
                        },
                      })}
                    />
                  </FormItem>
                  {["Base", "Bsc"].indexOf(project.chain) >= 0 && (
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
                      );
                    }}
                  />
                </form>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button isDisabled={updating} onClick={onClose}>
                Cancel
              </Button>
              <Button
                color="primary"
                isLoading={updating}
                onClick={() => handleSubmit(onFormSubmit)()}
              >
                Submit
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
