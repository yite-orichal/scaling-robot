import { ReactNode } from "react";
import { FieldError, Merge } from "react-hook-form";

export default function FormItem({
  children,
  label,
  error,
}: {
  children: ReactNode;
  label: ReactNode;
  error?: Merge<FieldError, (FieldError | undefined)[]> | undefined;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-row items-baseline gap-3">
        <div>{label}</div>
        <div className={`flex-1 ${error ? "border border-red-500" : ""}`}>
          {children}
        </div>
      </div>
      {error && (
        <div className="text-red-600 text-right text-sm">
          {error.message ? error.message.toString() : `this field has error`}
        </div>
      )}
    </div>
  );
}
