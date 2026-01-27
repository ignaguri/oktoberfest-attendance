"use client";
import { createSwitch } from "@gluestack-ui/core/switch/creator";
import { tva } from "@gluestack-ui/utils/nativewind-utils";
import { withStyleContext } from "@gluestack-ui/utils/nativewind-utils";
// Import contract types from shared UI package
import type { SwitchSize } from "@prostcounter/ui";
import React from "react";
import { Switch as RNSwitch } from "react-native";

const UISwitch = createSwitch({
  Root: withStyleContext(RNSwitch),
});

const switchStyle = tva({
  base: "disabled:cursor-not-allowed data-[invalid=true]:rounded-xl data-[invalid=true]:border-2 data-[invalid=true]:border-error-700 data-[disabled=true]:opacity-40 data-[focus=true]:outline-0 data-[focus=true]:ring-2 data-[focus=true]:ring-indicator-primary web:cursor-pointer",

  variants: {
    size: {
      sm: "scale-75",
      md: "",
      lg: "scale-125",
    },
  },
});

/**
 * Switch Props - implements @prostcounter/ui SwitchProps contract
 */
type ISwitchProps = React.ComponentProps<typeof UISwitch> & {
  /** Size of the switch - from contract */
  size?: SwitchSize;
  /** Additional className for styling */
  className?: string;
};

const Switch = React.forwardRef<
  React.ComponentRef<typeof UISwitch>,
  ISwitchProps
>(function Switch({ className, size = "md", ...props }, ref) {
  return (
    <UISwitch
      ref={ref}
      {...props}
      className={switchStyle({ size, class: className })}
    />
  );
});

Switch.displayName = "Switch";
export { Switch };
