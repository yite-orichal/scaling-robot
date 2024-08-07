"use client";

import { ProjectResp } from "@/hooks";
import { useGetAddrBalanceCmd } from "@/hooks/chain";
import {
  createContext,
  Dispatch,
  ReactNode,
  SetStateAction,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import toast from "react-hot-toast";

type ProjectContextType = {
  project: ProjectResp;
  setProject: Dispatch<SetStateAction<ProjectResp>>;
  mainWalletBalance: string;
  isLoadingMainWalletBalance: boolean;
  refreshMainWalletBalance: () => void;
  nativeCoinSymbol: string;
  explorerBaseUrl: string;
};

const ProjectContext = createContext<ProjectContextType | null>(null);

export const useProject = () => {
  const ctx = useContext(ProjectContext);
  if (!ctx) {
    throw new Error("must have a project state");
  }

  return ctx;
};

export default function ProjectProvider({
  children,
  project,
}: {
  children: ReactNode;
  project: ProjectResp;
}) {
  const [_project, setProject] = useState(project);

  const nativeCoinSymbol = useMemo(() => {
    if (_project.chain === "Solana") {
      return "SOL";
    }

    return "ETH";
  }, [_project]);

  const explorerBaseUrl = useMemo(() => {
    if (_project.chain === "Solana") {
      return "https://solscan.io";
    }

    return "https://basescan.org";
  }, [_project]);

  const {
    getAddrBalance: getMainWalletBalance,
    balance: mainWalletBalance,
    getting: isLoadingMainWalletBalance,
  } = useGetAddrBalanceCmd();

  const refreshMainWalletBalance = async () => {
    try {
      await getMainWalletBalance({
        chain: project.chain,
        addr: project.main_wallet,
      });
    } catch (e) {
      const err = e as { err_msg: string };
      toast.error(`get main wallet balance error: ${err.err_msg}`);
    }
  };

  useEffect(() => {
    async function init() {
      await refreshMainWalletBalance();
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  return (
    <ProjectContext.Provider
      value={{
        project: _project,
        setProject,
        mainWalletBalance: mainWalletBalance?.bal_ui || "0",
        isLoadingMainWalletBalance,
        refreshMainWalletBalance,
        nativeCoinSymbol,
        explorerBaseUrl,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}
