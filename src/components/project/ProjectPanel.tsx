import { abbr } from "@/app/utils";
import { CreateWalletGrpResp } from "@/hooks";
import { Card, CardBody, CardHeader } from "@nextui-org/react";
import { useState } from "react";
import { CgExport } from "react-icons/cg";
import { FiPlusSquare } from "react-icons/fi";
import { LiaEdit } from "react-icons/lia";
import { MdRefresh } from "react-icons/md";
import CopyButton from "../CopyButton";
import IconButton from "../IconButton";
import CreateWalletGrpModal from "../wallet/CreateWalletGrpModal";
import EditProjectModal from "./EditModal";
import { useProject } from "./Provider";
import MainWalletWithdrawModal from "./WithdrawModal";
import { AiOutlineImport } from "react-icons/ai";

export default function ProjectPanel({
  canEdit = true,
  onWalletGrpCreated,
}: {
  canEdit?: boolean;
  onWalletGrpCreated: (resp: CreateWalletGrpResp) => void;
}) {
  const [createWalletGrpModalState, setCreateWalletGrpModalState] = useState({
    isImport: false,
    isOpen: false,
  });

  const [isUpdateProjectModalOpen, setIsUpdateProjectModalOpen] =
    useState(false);
  const [isMainWalletWithdrawModalOpen, setIsMainWalletWithdrawModalOpen] =
    useState(false);

  const {
    project,
    setProject,
    mainWalletBalance,
    isLoadingMainWalletBalance,
    refreshMainWalletBalance,
    nativeCoinSymbol,
  } = useProject();

  return (
    <div>
      <Card classNames={{ header: "py-1.5", body: "pt-1" }}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="font-bold">Project Info</div>
            <IconButton
              isDisabled={!canEdit}
              tooltip={"Edit Project"}
              Icon={LiaEdit}
              onClick={() => {
                setIsUpdateProjectModalOpen(true);
              }}
            />
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-3 gap-1">
            <div>Chain: {project.chain}</div>
            <div className="col-span-2 flex items-center gap-1">
              <div>Main Wallet: {abbr(project.main_wallet, 10)}</div>
              <div>
                ({mainWalletBalance} {nativeCoinSymbol})
              </div>
              <IconButton
                tooltip={"Refresh Balance"}
                Icon={MdRefresh}
                iconClassName={`${isLoadingMainWalletBalance ? "animate-spin" : ""}`}
                onClick={refreshMainWalletBalance}
              />
              <CopyButton
                content={project.main_wallet}
                tooltip={"Copy Address"}
              />
              <IconButton
                tooltip={"Withdraw"}
                Icon={CgExport}
                onClick={() => setIsMainWalletWithdrawModalOpen(true)}
              />
            </div>
            <div className="flex items-center gap-1">
              <div>Proxy Count: {project.proxy_urls.length}</div>
            </div>
            <div className="col-span-2">
              {(() => {
                const url = new URL(project.rpc);
                return `Rpc Url: ${url.protocol}//${url.host}`;
              })()}
            </div>
            <div className="flex items-center gap-1">
              <div>Wallet Groups: {project.wallet_grps.length}</div>
              <IconButton
                tooltip={"Add Wallet Group"}
                Icon={FiPlusSquare}
                onClick={() =>
                  setCreateWalletGrpModalState({
                    isImport: false,
                    isOpen: true,
                  })
                }
              />
              <IconButton
                tooltip={"Import Wallet Group"}
                Icon={AiOutlineImport}
                onClick={() => {
                  setCreateWalletGrpModalState({
                    isImport: true,
                    isOpen: true,
                  });
                }}
              />
            </div>
            <div className="col-span-2">Agg Api Url: {project.agg_api_url}</div>
          </div>
        </CardBody>
      </Card>
      {isUpdateProjectModalOpen && (
        <EditProjectModal
          isOpen={isUpdateProjectModalOpen}
          onOpenChange={(isOpen) => setIsUpdateProjectModalOpen(isOpen)}
          onSaved={async (resp) => {
            setIsUpdateProjectModalOpen(false);
            setProject(resp);
          }}
        />
      )}
      {createWalletGrpModalState.isOpen && (
        <CreateWalletGrpModal
          isOpen={createWalletGrpModalState.isOpen}
          isImport={createWalletGrpModalState.isImport}
          onOpenChange={(isOpen) =>
            setCreateWalletGrpModalState((old) => ({ ...old, isOpen }))
          }
          onWalletGrpCreated={(grp) => {
            setCreateWalletGrpModalState((old) => ({ ...old, isOpen: false }));
            onWalletGrpCreated(grp);
          }}
        />
      )}
      {isMainWalletWithdrawModalOpen && (
        <MainWalletWithdrawModal
          balance={Number(mainWalletBalance)}
          isOpen={isMainWalletWithdrawModalOpen}
          onOpenChange={(isOpen) => {
            setIsMainWalletWithdrawModalOpen(isOpen);
            if (!isOpen) {
              refreshMainWalletBalance();
            }
          }}
        />
      )}
    </div>
  );
}
