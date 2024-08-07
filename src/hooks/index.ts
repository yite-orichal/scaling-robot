import { invoke, InvokeArgs } from "@tauri-apps/api/core";
import { useState } from "react";

export * from "./project";
export * from "./wallet";

export function useCmd<Resp, Req extends InvokeArgs | undefined>(
  cmd: string,
  defaultVal?: Resp,
) {
  const [invoking, setInvoking] = useState<boolean>(false);
  const [result, setResult] = useState<Resp | undefined>(defaultVal);
  const [error, setError] = useState<{ err_msg: string } | undefined>();

  const invokeFn = async (params?: Req) => {
    setInvoking(true);
    try {
      const msg: Resp = await invoke(cmd, params);
      setError(undefined);
      setResult(msg);
      return msg;
    } catch (e) {
      let err = e as { err_msg: string };
      if (typeof e === "string") {
        err = { err_msg: e };
      }
      setResult(defaultVal);
      setError(err);
      throw err;
    } finally {
      setInvoking(false);
    }
  };

  return {
    invokeFn,
    invoking,
    result,
    setResult,
    error,
  };
}

export function useSayHelloCmd() {
  const {
    invokeFn: sayHello,
    invoking: sayHelloing,
    result: sayHelloAnswer,
    error: sayHelloError,
  } = useCmd<string, { name: string }>("say_hello", "");

  return {
    sayHello,
    sayHelloing,
    sayHelloAnswer,
    sayHelloError,
  };
}

export function useEthBlockHeightCmd() {
  const {
    invokeFn: getEthBlockHeight,
    invoking: getingEthBlockHeight,
    result: ethBlockHeight,
    error: getEthBlockHeightError,
  } = useCmd<string, undefined>("eth_latest_block");

  return {
    getEthBlockHeight,
    getingEthBlockHeight,
    ethBlockHeight,
    getEthBlockHeightError,
  };
}

export function useGetIpGeoCmd() {
  const {
    invokeFn: getIpGeo,
    invoking: getingIpGeo,
    result: ipGeo,
    error: getIpGeoError,
  } = useCmd<any, undefined>("get_ip_geo", null);

  return {
    getIpGeo,
    getingIpGeo,
    ipGeo,
    getIpGeoError,
  };
}

export function useGenSokKeypairCmd() {
  const {
    invokeFn: genSolKeypair,
    invoking: generatingSolKeypair,
    result: solKeypairs,
    error: genSolKeypairError,
  } = useCmd<string[], { cnt: number }>("sol_gen_keypair", []);

  return {
    genSolKeypair,
    generatingSolKeypair,
    solKeypairs,
    genSolKeypairError,
  };
}

export function useSaveFileCmd() {
  const {
    invokeFn: saveFile,
    invoking: savingFile,
    error: saveError,
  } = useCmd<null, { path: string; data: string }>("save_file", null);

  return {
    saveFile,
    savingFile,
    saveError,
  };
}
