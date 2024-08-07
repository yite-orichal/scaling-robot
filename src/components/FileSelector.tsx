import { Button, Input } from "@nextui-org/react";
import * as dialog from "@tauri-apps/plugin-dialog";
import { useState } from "react";

export default function FileSelector({
  placeholder,
  onChange,
}: {
  placeholder?: string;
  onChange: (filePath: string) => void;
}) {
  const [filePath, setFilePath] = useState<string>("");
  const selectPath = async () => {
    const resp = await dialog.open({
      title: "Select Proxy File",
      directory: false,
      multiple: false,
      recursive: false,
      filters: [{ name: "txt", extensions: ["txt"] }],
    });
    if (resp?.path) {
      setFilePath(resp.path);
      onChange(resp.path);
    }
  };
  return (
    <div className="flex flex-row gap-1">
      <Input
        readOnly
        placeholder={placeholder}
        value={filePath}
        onClick={selectPath}
      />
      <Button onClick={selectPath}>Select File</Button>
    </div>
  );
}
