import { useCmd } from ".";

export type Chain = "Solana" | "Base";

export type CreateProjectReq = {
  id: string;
  name: string;
  chain: Chain;
  rpc: string;
  agg_api_url: string;
  agg_api_key?: string;
  proxy_urls: string[];
  save_path: string;
};

export function useCreateProjectCmd() {
  const {
    invokeFn: createProject,
    invoking: creating,
    error: createProjectErr,
  } = useCmd<null, { req: CreateProjectReq }>("create_project", null);

  return {
    createProject,
    creating,
    createProjectErr,
  };
}

export type WalletGrpResp = {
  id: string;
  name: string;
  chain: Chain;
  addresses: [string, string][];
};

export type ProjectResp = {
  id: string;
  name: string;
  chain: Chain;
  main_wallet: string;
  main_wallet_pk: string;
  rpc: string;
  agg_api_url: string;
  agg_api_key?: string;
  proxy_urls: string[];
  wallet_grps: WalletGrpResp[];
};

export type UpdateProjectReq = {
  main_wallet_pk: string;
  proxy_urls: string[];
  rpc_url: string;
  agg_api_url: string;
  agg_api_key?: string;
};

export function useOpenProjectCmd() {
  const {
    invokeFn: openProject,
    invoking: opening,
    result: project,
    setResult: setProject,
    error: openProjectError,
  } = useCmd<ProjectResp, { path: string }>("open_project");

  return {
    openProject,
    opening,
    project,
    setProject,
    openProjectError,
  };
}

export function useCloseProjectCmd() {
  const {
    invokeFn: closeProject,
    invoking: closing,
    error: closeProjectError,
  } = useCmd<null, undefined>("close_project");

  return {
    closeProject,
    closing,
    closeProjectError,
  };
}

export function useUpdateProjectCmd() {
  const {
    invokeFn: updateProject,
    invoking: updating,
    result: project,
    error: updateProjectError,
  } = useCmd<ProjectResp, { req: UpdateProjectReq }>("update_project");

  return {
    updateProject,
    updating,
    project,
    updateProjectError,
  };
}
