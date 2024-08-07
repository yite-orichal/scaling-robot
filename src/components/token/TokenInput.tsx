import TextInput from "../TextInput";
import { TokenInfo, useGetTokenInfoCmd } from "@/hooks/chain";
import { Chain } from "@/hooks";
import { Tooltip } from "@nextui-org/react";
import { MdOutlineErrorOutline } from "react-icons/md";
import { ImSpinner2 } from "react-icons/im";

export default function TokenInput({
  inputRef,
  chain,
  isDisabled = false,
  defaultValue,
  onChange,
  onBlur,
}: {
  inputRef: any;
  chain: Chain;
  isDisabled?: boolean;
  autoFocus?: boolean;
  defaultValue?: TokenInfo;
  onChange: (info: TokenInfo | undefined) => void;
  onBlur: (evt: any) => void;
}) {
  const { getTokenInfo, getting, setTokenInfo, getTokenInfoError } =
    useGetTokenInfoCmd(defaultValue);

  const onTokenAddrChange = async (addr: string) => {
    if (addr.length > 0) {
      try {
        const info = await getTokenInfo({ chain, addr });
        onChange(info);
      } catch {
        // already use useCommand error state
      }
    } else {
      setTokenInfo(undefined);
      onChange(undefined);
    }
  };

  return (
    <div className="flex items-center gap-0">
      <TextInput
        isClearable
        ref={inputRef}
        isDisabled={isDisabled || getting}
        onValueChange={onTokenAddrChange}
        onBlur={onBlur}
      />
      {getting && (
        <div className="px-1">
          <ImSpinner2 className="animate-spin" />
        </div>
      )}
      {getTokenInfoError && (
        <Tooltip
          showArrow
          placement="left"
          content={getTokenInfoError.err_msg}
          color="danger"
        >
          <div className="px-1">
            <MdOutlineErrorOutline className="text-red-500" />
          </div>
        </Tooltip>
      )}
    </div>
  );
}
