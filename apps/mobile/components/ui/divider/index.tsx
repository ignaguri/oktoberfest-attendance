"use client";
import { tva } from "@gluestack-ui/utils/nativewind-utils";
import React from "react";
import { Platform, View } from "react-native";

// Import contract types from shared UI package
import type { SeparatorOrientation } from "@prostcounter/ui";

const dividerStyle = tva({
  base: "bg-background-200",
  variants: {
    orientation: {
      vertical: "h-full w-px",
      horizontal: "h-px w-full",
    },
  },
});

/**
 * Divider Props - implements @prostcounter/ui SeparatorProps contract
 */
type IUIDividerProps = React.ComponentPropsWithoutRef<typeof View> & {
  /** Orientation of the divider - from contract */
  orientation?: SeparatorOrientation;
  /** Additional className for styling */
  className?: string;
};

const Divider = React.forwardRef<
  React.ComponentRef<typeof View>,
  IUIDividerProps
>(function Divider({ className, orientation = "horizontal", ...props }, ref) {
  return (
    <View
      ref={ref}
      {...props}
      aria-orientation={orientation}
      role={Platform.OS === "web" ? "separator" : undefined}
      className={dividerStyle({
        orientation,
        class: className,
      })}
    />
  );
});

Divider.displayName = "Divider";

export { Divider };
