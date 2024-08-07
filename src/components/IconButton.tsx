import { Tooltip, tv } from "@nextui-org/react";
import { ReactNode } from "react";
import { IconType } from "react-icons";

export default function IconButton({
  isDisabled = false,
  tooltip,
  Icon,
  iconClassName = "",
  rotate180 = false,
  onClick,
}: {
  isDisabled?: boolean;
  tooltip: ReactNode;
  Icon: IconType;
  iconClassName?: string;
  rotate180?: boolean;
  onClick?: () => void;
}) {
  const icon = tv({
    variants: {
      disabled: {
        true: "text-gray-400",
        false: "text-sky-300",
      },
    },
  });

  return (
    <Tooltip content={tooltip} color="secondary">
      <div
        className={`${isDisabled ? "" : "cursor-pointer"} ${rotate180 ? "rotate-180" : ""}`}
        onClick={() => {
          if (!isDisabled && onClick) {
            onClick();
          }
        }}
      >
        <Icon
          className={icon({ class: iconClassName, disabled: isDisabled })}
        />
      </div>
    </Tooltip>
  );
}
