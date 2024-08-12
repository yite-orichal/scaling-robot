import { Tooltip } from "@nextui-org/react";
import { BsQuestionCircle } from "react-icons/bs";

export default function ProxyEditorTooltip() {
  return (
    <Tooltip
      color="secondary"
      showArrow
      content={
        <div className="flex flex-col gap-1">
          <div>Please select a plain text file split by line</div>
          <div>
            Line format:{" "}
            <span className="bg-gray-300 text-black px-1 py-0.5 rounded">
              protocol://username:password@host:port
            </span>
          </div>
          <div>Examples: </div>
          <div>
            <span className="bg-gray-300 text-black px-1 py-0.5 rounded">
              http://bob:secret@bob_proxy.com:1920
            </span>
          </div>
          <div>
            <span className="bg-gray-300 text-black px-1 py-0.5 rounded">
              https://no_auth_needed_proxy.com
            </span>
          </div>
          <div>
            <span className="bg-gray-300 text-black px-1 py-0.5 rounded">
              socks5://alice:alice_secret@alice_proxy.com:1089
            </span>
          </div>
          <div>
            <span className="bg-gray-300 text-black px-1 py-0.5 rounded">
              socks5://127.0.0.1:1089
            </span>
          </div>
        </div>
      }
    >
      <div>
        <BsQuestionCircle />
      </div>
    </Tooltip>
  );
}
