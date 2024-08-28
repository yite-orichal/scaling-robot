import { WalletGrpResp } from "@/hooks";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Radio,
  RadioGroup,
  Slider,
  Switch,
  Tooltip,
} from "@nextui-org/react";
import * as webview from "@tauri-apps/api/webviewWindow";
import { TauriEvent } from "@tauri-apps/api/event";
import TokenInput from "../token/TokenInput";
import FormItem from "../FormItem";
import { Controller, useForm } from "react-hook-form";
import { CreateTaskReq, useCreateTradeTaskCmd } from "@/hooks/tasks";
import { NumericFormat } from "react-number-format";
import { useMemo } from "react";
import { BsQuestionCircle } from "react-icons/bs";
import { useProject } from "../project/Provider";

export type TaskStatus = "Stopped" | "Running";
export type Task = {
  id: string;
  status: TaskStatus;
};

export default function CreateTaskPanel({
  walletGrp,
  task,
  onTaskCreated,
  onTaskRemoved,
}: {
  walletGrp: WalletGrpResp;
  task: Task;
  onTaskCreated: (task: Task) => void;
  onTaskRemoved: (id: string) => void;
}) {
  const { project } = useProject();
  const labelClassName = "w-32 text-right";

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm<CreateTaskReq>({
    defaultValues: {
      percetage: [0.15, 0.3],
      slippage: 0.02,
      trade_mode: "Both",
      use_jito: false,
      gas_price: walletGrp.chain === "Solana" ? 0.01 : 0.02,
      interval_secs: 1,
      workers_cnt: 2,
    },
  });

  const isUseJito = watch("use_jito");

  const [gasPriceLabel, gasPriceUnit] = useMemo(() => {
    if (walletGrp.chain === "Solana") {
      if (isUseJito) {
        setValue("gas_price", 0.000005);
        return ["Jito Tip", "SOL"];
      }

      setValue("gas_price", 0.1);
      return ["CU Price", "Lamports"];
    }

    return ["Gas Price", "Gwei"];
  }, [walletGrp.chain, isUseJito, setValue]);

  const { createTradeTask, creating, createTradeTaskErr } =
    useCreateTradeTaskCmd();

  const onFormSubmit = async (data: CreateTaskReq) => {
    data.wallet_grp_id = walletGrp.id;
    data.percetage = data.percetage.map((x) => Math.round(x * 100)) as [
      number,
      number,
    ];
    data.slippage =
      walletGrp.chain === "Solana"
        ? Math.round(data.slippage * 10000)
        : Math.round(data.slippage * 100);
    data.gas_price =
      walletGrp.chain === "Solana"
        ? data.use_jito
          ? // SOL
            Math.round(data.gas_price * 1e9)
          : // to micro lamports
            Math.round(data.gas_price * 1e6)
        : Math.round(data.gas_price * 1e9);
    data.workers_cnt = Number(data.workers_cnt);
    data.interval_secs = Number(data.interval_secs);

    const label = `task_${walletGrp.id}`;
    const searchParams = new URLSearchParams();
    searchParams.set("chain", walletGrp.chain);
    searchParams.set("walletGrpName", walletGrp.name);
    searchParams.set("walletGrpId", data.wallet_grp_id);
    searchParams.set("tradeMode", data.trade_mode);
    searchParams.set("tokenSymbol", data.token.symbol);

    let allWebviewWindows = await webview.getAllWebviewWindows();
    let wv = allWebviewWindows.find((wv) => wv.label === label);
    if (wv) {
      wv.show();
    } else {
      let created = false;
      try {
        await createTradeTask({ req: data });
        created = true;
      } catch (e) {
        // already use createTradeTask error state
      }

      if (!created) {
        return;
      }

      let title =
        `Wallet Group ${walletGrp.name} ` +
        `${data.trade_mode === "Both" ? "Sell / Buy" : data.trade_mode} ` +
        `token ${data.token.symbol}`;
      const w = new webview.WebviewWindow(label, {
        title,
        width: 1080,
        height: 800,
        minHeight: 800,
        minWidth: 1024,
        closable: false,
        url: `/task?${searchParams.toString()}`,
      });

      let unlisten = w.listen(TauriEvent.WINDOW_DESTROYED, () => {
        onTaskRemoved(walletGrp.id);
        unlisten.then((f) => f());
      });

      onTaskCreated({
        id: walletGrp.id,
        status: "Running",
      });
    }
  };

  return (
    <Card
      className="flex-1 min-h-full max-h-full"
      classNames={{ body: "pt-1" }}
    >
      <CardHeader>
        <div className="font-bold">Task Setup</div>
      </CardHeader>
      <CardBody>
        <form
          className="flex flex-col gap-4"
          onSubmit={handleSubmit(onFormSubmit)}
        >
          <FormItem label={<div className={labelClassName}>Wallet Group </div>}>
            <div>{walletGrp?.name}</div>
          </FormItem>
          <Controller
            name="token"
            control={control}
            rules={{ required: { value: true, message: "Token is required" } }}
            render={({ field }) => (
              <div className="flex flex-col gap-1">
                <FormItem
                  label={<div className={labelClassName}>Token</div>}
                  error={errors.token}
                >
                  <TokenInput
                    isDisabled={task.status === "Running"}
                    inputRef={field.ref}
                    chain={walletGrp.chain}
                    onBlur={field.onBlur}
                    onChange={(data) => field.onChange(data)}
                  />
                </FormItem>
                {field.value && (
                  <div className="flex text-sm text-success gap-5 pl-[9rem]">
                    <div>Name: {field.value.name}</div>
                    <div>Symbol: {field.value.symbol}</div>
                    <div>Decimals: {field.value.decimals}</div>
                  </div>
                )}
              </div>
            )}
          />

          <FormItem
            label={<div className={labelClassName}>Trade Mode</div>}
            error={errors.trade_mode}
          >
            <Controller
              name="trade_mode"
              control={control}
              render={({ field }) => {
                return (
                  <RadioGroup
                    orientation="horizontal"
                    isDisabled={task.status === "Running"}
                    value={field.value}
                    onChange={field.onChange}
                  >
                    <Radio value={"Both"}>Both</Radio>
                    <Radio value={"BuyOnly"}>Buy Only</Radio>
                    <Radio value={"SellOnly"}>Sell Only</Radio>
                  </RadioGroup>
                );
              }}
            />
          </FormItem>
          <FormItem
            label={<div className={labelClassName}>Percentage</div>}
            error={errors.percetage}
          >
            <Controller
              name="percetage"
              control={control}
              render={({ field }) => {
                return (
                  <Slider
                    label=" "
                    aria-label="Percetage"
                    size="md"
                    color="secondary"
                    formatOptions={{
                      style: "percent",
                      minimumFractionDigits: 0,
                    }}
                    showTooltip={true}
                    step={0.01}
                    minValue={0.01}
                    maxValue={1}
                    isDisabled={task.status === "Running"}
                    value={field.value}
                    onChange={field.onChange}
                  />
                );
              }}
            />
          </FormItem>
          <FormItem label={<div className={labelClassName}>Slippage</div>}>
            <Controller
              name="slippage"
              control={control}
              render={({ field }) => {
                return (
                  <Slider
                    label=" "
                    aria-label="Slippage"
                    size="md"
                    color="success"
                    formatOptions={{
                      style: "percent",
                      minimumFractionDigits: 0,
                    }}
                    showTooltip={true}
                    step={0.01}
                    minValue={0.01}
                    maxValue={0.5}
                    isDisabled={task.status === "Running"}
                    value={field.value}
                    onChange={field.onChange}
                  />
                );
              }}
            />
          </FormItem>
          {walletGrp.chain === "Solana" && (
            <>
              <FormItem label={<div className={labelClassName}>Use Jito</div>}>
                <Switch aria-label="Use Jito" {...register("use_jito")} />
              </FormItem>
              <FormItem
                label={<div className={labelClassName}>{gasPriceLabel}</div>}
              >
                <Controller
                  name="gas_price"
                  control={control}
                  render={({ field }) => {
                    return (
                      <NumericFormat
                        aria-label="Gas Price"
                        customInput={Input}
                        decimalScale={6}
                        thousandSeparator
                        endContent={
                          <span className="text-default-400">
                            {gasPriceUnit}
                          </span>
                        }
                        isDisabled={task.status === "Running"}
                        value={field.value}
                        onValueChange={(v) => field.onChange(v.value)}
                      />
                    );
                  }}
                />
              </FormItem>
            </>
          )}
          <FormItem
            label={
              <div
                className={`${labelClassName} flex items-center justify-end gap-1`}
              >
                <div>Workers</div>
                <Tooltip
                  color="secondary"
                  showArrow
                  content={
                    <div>
                      <div>
                        It means how many swap transaction can process in the
                        same time
                      </div>
                      <div>{`Better smaller than proxy count: ${project.proxy_urls.length}`}</div>
                      <div>{`And smaller than wallet group address count: ${walletGrp.addresses.length}`}</div>
                    </div>
                  }
                >
                  <div>
                    <BsQuestionCircle />
                  </div>
                </Tooltip>
              </div>
            }
          >
            <Controller
              name="workers_cnt"
              control={control}
              render={({ field }) => {
                return (
                  <NumericFormat
                    aria-label="Worker Count"
                    customInput={Input}
                    decimalScale={0}
                    thousandSeparator
                    isDisabled={task.status === "Running"}
                    value={field.value}
                    onValueChange={(v) => field.onChange(v.value)}
                  />
                );
              }}
            />
          </FormItem>
          <FormItem
            label={<div className={`${labelClassName}`}>Trade Interval</div>}
          >
            <Controller
              name="interval_secs"
              control={control}
              render={({ field }) => {
                return (
                  <NumericFormat
                    aria-label="Worker Count"
                    customInput={Input}
                    endContent={
                      <span className="text-default-400">Seconds</span>
                    }
                    decimalScale={0}
                    thousandSeparator
                    isDisabled={task.status === "Running"}
                    value={field.value}
                    onValueChange={(v) => field.onChange(v.value)}
                  />
                );
              }}
            />
          </FormItem>
          {createTradeTaskErr && (
            <div className="text-danger">{createTradeTaskErr.err_msg} </div>
          )}
          <Button
            isDisabled={!isValid}
            isLoading={creating}
            className="w-full"
            color={task.status === "Stopped" ? "primary" : "warning"}
            type="submit"
          >
            {task.status === "Stopped" ? "Start Task" : "Show Task Window"}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
