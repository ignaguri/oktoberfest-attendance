"use client";
import { tva } from "@gluestack-ui/utils/nativewind-utils";
import { cssInterop } from "nativewind";
import React from "react";
import { ActivityIndicator } from "react-native";

import { MugLoader } from "./mug-loader";

cssInterop(ActivityIndicator, {
  className: { target: "style", nativeStyleToProp: { color: true } },
});

const spinnerStyle = tva({});

const Spinner = React.forwardRef<
  React.ComponentRef<typeof ActivityIndicator>,
  React.ComponentProps<typeof ActivityIndicator>
>(function Spinner(
  {
    className,
    size,
    color = "#F59E0B",
    focusable = false,
    "aria-label": ariaLabel = "loading",
    ...props
  },
  ref,
) {
  // Page and section loading gets the filling mug; inline and button loading
  // keeps the native spinner, since the mug is illegible that small and its art
  // cannot take `color`.
  if (size === "large") {
    return <MugLoader className={className} />;
  }

  return (
    <ActivityIndicator
      ref={ref}
      focusable={focusable}
      aria-label={ariaLabel}
      {...props}
      size={size}
      color={color}
      className={spinnerStyle({ class: className })}
    />
  );
});

Spinner.displayName = "Spinner";

export { Spinner };
