import { MdCheck, MdOutlineContentCopy } from "react-icons/md";
import IconButton from "./IconButton";
import * as clipboard from "@tauri-apps/plugin-clipboard-manager";
import { useState } from "react";

export default function CopyButton({
  content,
  tooltip,
}: {
  content: string;
  tooltip?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <IconButton
      tooltip={tooltip}
      Icon={copied ? MdCheck : MdOutlineContentCopy}
      iconClassName={`${copied ? "text-success" : "text-sky-300"}`}
      onClick={async () => {
        await clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => {
          setCopied(false);
        }, 1000);
      }}
    />
  );
}
