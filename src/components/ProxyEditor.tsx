import { Button, Textarea } from "@nextui-org/react";
import * as dialog from "@tauri-apps/plugin-dialog";
import * as fs from "@tauri-apps/plugin-fs";
import { useState } from "react";

export default function ProxyEditor({
  value,
  onChange,
}: {
  value: string[];
  onChange: (lines: string[]) => void;
}) {
  const [textContent, setTextContent] = useState(value.join("\n"));
  const selectFile = async () => {
    const path = await dialog.open({
      title: "Select Proxy File",
      directory: false,
      multiple: false,
      recursive: false,
      filters: [{ name: "txt", extensions: ["txt"] }],
    });
    if (path) {
      const fileLines = await fs.readTextFile(path);
      const lines = fileLines
        .split("\n")
        .map((it) => it.trim())
        .filter((it) => it.length > 0);

      setTextContent((old) => {
        const oldLines = old.split("\n");
        const newLines = [...oldLines, ...lines].filter(
          (it) => it.trim().length > 0,
        );
        onChange(newLines);
        return newLines.join("\n");
      });
    }
  };

  const onTextAreaChange = (content: string) => {
    setTextContent(content);

    const lines = content
      .split("\n")
      .map((it) => it.trim())
      .filter((it) => it.length > 0);

    onChange(lines);
  };

  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="flex gap-1 items-center">
        <Button
          size="sm"
          color="secondary"
          className="px-2 py-0.5 h-6"
          onClick={selectFile}
        >
          Import From File
        </Button>
      </div>
      <div className="w-full">
        <Textarea
          minRows={5}
          maxRows={5}
          value={textContent}
          onValueChange={onTextAreaChange}
        />
      </div>
    </div>
  );
}
