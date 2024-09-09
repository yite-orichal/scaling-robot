/* eslint-disable @next/next/no-img-element */
"use client";

import * as dialog from "@tauri-apps/plugin-dialog";
import CreateProjectModal from "@/components/project/CreateModal";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as win from "@tauri-apps/api/window";
import { Button } from "@nextui-org/react";

export default function Home() {
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    win.getCurrentWindow().setTitle("Moo Tools");
  }, []);

  return (
    <main className="flex flex-col gap-1 p-2 h-screen">
      <div className="flex flex-col items-center pt-48 gap-6 h-screen">
        <div className="flex flex-col gap-2 items-center justify-center">
          <img src="logo_128x128.png" alt="Logo Image" />
          <p className="font-bold text-2xl">Moo Tools</p>
        </div>
        <div className="flex flex-col items-center gap-4">
          <p>Create or Open a Moo Tools project file</p>
          <div className="flex items-center gap-5">
            <ActionCard onClick={() => setIsCreateProjectOpen(true)}>
              Create
            </ActionCard>
            <ActionCard
              onClick={async () => {
                const filePath = await dialog.open({
                  directory: false,
                  filters: [{ name: "Project Files", extensions: ["maproj"] }],
                });
                if (filePath) {
                  router.replace(`/project?path=${filePath}`);
                }
              }}
            >
              Open
            </ActionCard>
          </div>
        </div>
      </div>
      {isCreateProjectOpen && (
        <CreateProjectModal
          isOpen={isCreateProjectOpen}
          onOpenChange={setIsCreateProjectOpen}
          onSaved={(path) => {
            setIsCreateProjectOpen(false);
            router.replace(`/project?path=${path}`);
          }}
        />
      )}
    </main>
  );
}

function ActionCard({
  children,
  onClick,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      className="p-2 w-36 h-36 text-xl border-1 border-white rounded-lg"
      variant="bordered"
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
