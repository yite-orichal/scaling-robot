import { AddrBalanceResp } from "@/hooks/chain";
import { createContext, useContext } from "react";

type ContentContextTypes = {
  averageWalletBalance:  string;
  setAverageWalletBalance: (balance:  string) => void;
};

const content = createContext<ContentContextTypes>({
  averageWalletBalance:"0",
  setAverageWalletBalance: () => {},
});
export const ContentProvider = content.Provider;
export const useContent = () => useContext(content);