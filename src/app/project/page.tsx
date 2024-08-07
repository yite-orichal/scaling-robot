"use client";

import {
  CreateWalletGrpResp,
  ProjectResp,
  useCloseProjectCmd,
  useOpenProjectCmd,
} from "@/hooks";
import { Button, Tab, Tabs } from "@nextui-org/react";
import { useEffect, useMemo, useState } from "react";
import * as win from "@tauri-apps/api/window";
import { useRouter } from "next/navigation";
import { MdArrowBackIosNew } from "react-icons/md";
import { toast } from "react-hot-toast";
import ProjectPanel from "@/components/project/ProjectPanel";
import { ImSpinner2 } from "react-icons/im";
import CreateTaskPanel, { Task } from "@/components/task/CreatePanel";
import WalletGroupPanel from "@/components/wallet/WalletGroupPanel";
import ProjectProvider, { useProject } from "@/components/project/Provider";
import _ from "lodash";

export default function ProjectPage() {
  const router = useRouter();
  const [filePath, setFilePath] = useState("");
  const { openProject, project, opening, openProjectError } =
    useOpenProjectCmd();
  const { closeProject } = useCloseProjectCmd();

  useEffect(() => {
    if (!project) return;
    win.getCurrentWindow().setTitle(`Project: ${project.name}`);
  }, [project]);

  const [tasks, setTasks] = useState<Record<string, Task>>({});

  useEffect(() => {
    async function init() {
      const url = new URL(window.location.href);
      const searchParams = new URLSearchParams(url.search);
      const path = searchParams.get("path");

      if (!path) {
        toast.error("can't find project file");
        return;
      }
      setFilePath(path);
      await openProject({ path });
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="p-2 flex flex-col gap-2 min-h-screen max-h-screen">
      <div className="flex items-center gap-3">
        <Button
          // className="rounded-full"
          isIconOnly
          isDisabled={_.keys(tasks).length > 0}
          onClick={async () => {
            await closeProject();
            router.replace("/");
          }}
        >
          <MdArrowBackIosNew />
        </Button>
        <div className="flex-1 items-center text-center">
          <div>{project?.name}</div>
          <div className="text-xs text-gray-400">{filePath}</div>
        </div>
      </div>
      <div className="flex flex-col min-h-[calc(100vh-4.2rem)] max-h-[calc(100vh-4.2rem)]">
        {opening && <LoadingUI />}
        {project && (
          <ProjectProvider project={project}>
            <ProjectUI
              tasks={tasks}
              onTaskCreated={(t) => {
                setTasks((old) => {
                  const newRecord = { ...old };
                  newRecord[t.id] = t;
                  return newRecord;
                });
              }}
              onTaskRemoved={(id) => {
                setTasks((old) => {
                  const newRecord = { ...old };
                  delete newRecord[id];
                  return newRecord;
                });
              }}
            />
          </ProjectProvider>
        )}
        {openProjectError && <OpenErrorUI err={openProjectError} />}
      </div>
    </main>
  );
}

function ProjectUI({
  tasks,
  onTaskCreated,
  onTaskRemoved,
}: {
  tasks: Record<string, Task>;

  onTaskCreated: (task: Task) => void;
  onTaskRemoved: (id: string) => void;
}) {
  const [selectedWalletGrpKey, setSelectedWalletGrpKey] = useState("");
  const { project, setProject } = useProject();

  const selectedWalletGrp = useMemo(() => {
    return project.wallet_grps.find((it) => it.id === selectedWalletGrpKey);
  }, [project, selectedWalletGrpKey]);

  const selectedTask = useMemo(() => {
    const task = tasks[selectedWalletGrpKey];
    return task || ({ id: selectedWalletGrpKey, status: "Stopped" } as Task);
  }, [selectedWalletGrpKey, tasks]);

  const onWalletGrpCreated = (grp: CreateWalletGrpResp) => {
    setSelectedWalletGrpKey(grp.id);
    setProject((old) => {
      let newGrps = [];
      if (!old?.wallet_grps) {
        newGrps.push(grp);
      } else {
        newGrps = [...old.wallet_grps, grp];
      }
      return { ...old, wallet_grps: newGrps } as ProjectResp;
    });
  };

  return (
    <div className="flex flex-col flex-1 gap-2 min-h-full max-h-full">
      <ProjectPanel
        onWalletGrpCreated={onWalletGrpCreated}
        canEdit={_.keys(tasks).length === 0}
      />
      <div>
        <Tabs
          aria-label="Wallet Groups"
          selectedKey={selectedWalletGrpKey}
          onSelectionChange={async (k) => {
            setSelectedWalletGrpKey(k as string);
          }}
        >
          {project.wallet_grps.map((grp) => (
            <Tab
              key={grp.id}
              title={
                tasks[grp.id]?.status === "Running" ? (
                  <div className="flex items-center gap-1">
                    <div>{grp.name}</div>
                    <ImSpinner2 className="animate-spin text-blue-400" />
                  </div>
                ) : (
                  <div>{grp.name}</div>
                )
              }
            />
          ))}
        </Tabs>
      </div>
      <div className="flex flex-1 gap-3 min-h-full max-h-full">
        <div className="flex-1 flex flex-col gap-1 min-h-full max-h-full">
          {selectedWalletGrp && (
            <WalletGroupPanel walletGrp={selectedWalletGrp} />
          )}
        </div>
        <div className="flex-1 flex flex-col gap-2 min-h-full max-h-full">
          {selectedWalletGrp && (
            <CreateTaskPanel
              walletGrp={selectedWalletGrp}
              task={selectedTask}
              onTaskCreated={onTaskCreated}
              onTaskRemoved={onTaskRemoved}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function OpenErrorUI({ err }: { err: { err_msg: string } }) {
  return (
    <div className="flex h-screen items-center justify-center">
      Open Error:{err.err_msg}
    </div>
  );
}
function LoadingUI() {
  return (
    <div className="flex h-screen items-center justify-center">Loading...</div>
  );
}
