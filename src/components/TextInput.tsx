import { Input, InputProps } from "@nextui-org/react";
import React, { Ref } from "react";

const TextInput = React.forwardRef(
  (props: InputProps, ref: Ref<HTMLInputElement>) => {
    return (
      <Input
        {...props}
        autoCorrect="off"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        ref={ref}
      />
    );
  },
);

TextInput.displayName = "TextInput";
export default TextInput;
