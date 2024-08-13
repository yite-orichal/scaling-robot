import { check, Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { app } from "@tauri-apps/api";
import { useEffect, useState } from "react";
import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@nextui-org/react";
import toast from "react-hot-toast";

let isCheckingUpdate = false;
export default function Updater({ className }: { className: string }) {
  const [update, setUpdate] = useState<Update | null>(null);
  const [currentVersion, setCurrentVersion] = useState("");
  const [newVersion, setNewVersion] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);

  const checkAndUpdate = async () => {
    console.log("start to check update... ");
    const _update = await check();
    console.log("has update? ", _update);
    setUpdate(_update);

    if (!_update) {
      setNewVersion("");
      setReleaseNotes("");
      return;
    }

    let downloaded = 0;
    let contentLength = 0;

    // alternatively we could also call update.download() and update.install() separately
    await _update.download((event) => {
      switch (event.event) {
        case "Started":
          contentLength = event.data.contentLength || 0;
          console.log(`started downloading ${event.data.contentLength} bytes`);
          break;
        case "Progress":
          downloaded += event.data.chunkLength;
          console.log(`downloaded ${downloaded} from ${contentLength}`);
          break;
        case "Finished":
          console.log("download finished");
          break;
      }
    });

    await _update.install();

    setNewVersion(_update.version);
    setReleaseNotes(_update.body || "");
  };

  const onUpgradeConfirmed = async () => {
    if (!update) {
      return;
    }

    setIsUpgrading(true);
    try {
      await relaunch();
    } catch (e) {
      toast.error(`upgrade failed: ${e}`);
    } finally {
      setIsUpgrading(false);
    }
  };

  useEffect(() => {
    if (window.location.protocol !== "tauri:") {
      return;
    }

    let init = async () => {
      console.log("use effect invoked !!!");
      if (isCheckingUpdate) {
        console.log("is checking update, return...");
        return;
      }
      if (!!newVersion) {
        console.log("already found update successed!");
        return;
      }

      isCheckingUpdate = true;
      setCurrentVersion(await app.getVersion());
      try {
        await checkAndUpdate();
      } catch {}
      isCheckingUpdate = false;

      const intervalHandle = setInterval(
        async () => {
          isCheckingUpdate = true;
          try {
            await checkAndUpdate();
          } catch {}
          isCheckingUpdate = false;
        },
        1000 * 60 * 5,
      );

      console.log("create interval", intervalHandle);
      return intervalHandle;
    };

    const intervalNumPromise = init();
    return () => {
      intervalNumPromise.then((intervalNum) => {
        if (intervalNum) {
          console.log("clear interval: ", intervalNum);
          clearInterval(intervalNum);
        }
      });
    };
  }, [newVersion]);

  return !!update ? (
    <>
      <div
        className={`${className} cursor-pointer`}
        onClick={() => setIsConfirmOpen(true)}
      >
        New version available, click here to upgrade!!
      </div>
      <Modal
        size="3xl"
        isOpen={isConfirmOpen}
        onOpenChange={(o) => setIsConfirmOpen(o)}
        isDismissable={false}
        hideCloseButton={isUpgrading}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Confirm Upgrade</ModalHeader>
              <ModalBody>
                <div className="felx flex-col space-y-3">
                  <div>
                    <div>
                      Current Version:{" "}
                      <span className="font-bold">v{currentVersion}</span>
                    </div>
                    <div>
                      New version found:{" "}
                      <span className="font-bold text-primary">
                        v{newVersion}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="font-bold">Release Notes</div>
                    {releaseNotes.split("\n").map((rn, idx) => {
                      return (
                        <pre key={idx}>
                          {idx + 1}. {rn}
                        </pre>
                      );
                    })}
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button isDisabled={isUpgrading} onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  color="primary"
                  onClick={onUpgradeConfirmed}
                  isLoading={isUpgrading}
                >
                  Restart and Upgrade
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  ) : (
    <></>
  );
}
