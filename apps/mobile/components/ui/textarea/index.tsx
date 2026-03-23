"use client";
import { createTextarea } from "@gluestack-ui/core/textarea/creator";
import type { VariantProps } from "@gluestack-ui/utils/nativewind-utils";
import { tva } from "@gluestack-ui/utils/nativewind-utils";
import {
  useStyleContext,
  withStyleContext,
} from "@gluestack-ui/utils/nativewind-utils";
import type { TextareaSize, TextareaVariant } from "@prostcounter/ui";
import React from "react";
import { TextInput, View } from "react-native";

const SCOPE = "TEXTAREA";
const UITextarea = createTextarea({
  Root: withStyleContext(View, SCOPE),
  Input: TextInput,
});

const textareaStyle = tva({
  base: "border-background-300 data-[disabled=true]:data-[hover=true]:border-background-300 data-[focus=true]:border-primary-700 data-[focus=true]:data-[hover=true]:border-primary-700 data-[hover=true]:border-outline-400 data-[disabled=true]:bg-background-50 h-[100px] w-full rounded border data-[disabled=true]:opacity-40",

  variants: {
    variant: {
      default:
        "data-[focus=true]:border-primary-700 data-[invalid=true]:border-error-700 data-[invalid=true]:data-[disabled=true]:data-[hover=true]:border-error-700 data-[invalid=true]:data-[focus=true]:data-[hover=true]:border-primary-700 data-[invalid=true]:data-[hover=true]:border-error-700 data-[focus=true]:web:ring-1 data-[invalid=true]:data-[disabled=true]:data-[hover=true]:web:ring-1 data-[invalid=true]:data-[focus=true]:data-[hover=true]:web:ring-1 data-[invalid=true]:web:ring-1 data-[focus=true]:web:ring-inset data-[invalid=true]:data-[disabled=true]:data-[hover=true]:web:ring-inset data-[invalid=true]:data-[focus=true]:data-[hover=true]:web:ring-inset data-[invalid=true]:web:ring-inset data-[focus=true]:web:ring-indicator-primary data-[invalid=true]:data-[disabled=true]:data-[hover=true]:web:ring-indicator-error data-[invalid=true]:data-[focus=true]:data-[hover=true]:web:ring-indicator-primary data-[invalid=true]:web:ring-indicator-error",
    },
    size: {
      sm: "",
      md: "",
      lg: "",
      xl: "",
    },
  },
});

const textareaInputStyle = tva({
  base: "color-typography-900 placeholder:text-typography-500 web:cursor-text web:outline-none web:outline-0 web:data-[disabled=true]:cursor-not-allowed flex-1 p-2",
  parentVariants: {
    size: {
      sm: "text-sm",
      md: "text-base",
      lg: "text-lg",
      xl: "text-xl",
    },
  },
});

/**
 * Textarea Props - implements @prostcounter/ui TextareaProps contract
 */
type ITextareaProps = Omit<
  React.ComponentProps<typeof UITextarea>,
  "context"
> & {
  /** Size of the textarea - from contract */
  size?: TextareaSize;
  /** Variant style of the textarea - from contract */
  variant?: TextareaVariant;
  /** Additional className for styling */
  className?: string;
};

const Textarea = React.forwardRef<
  React.ComponentRef<typeof UITextarea>,
  ITextareaProps
>(function Textarea(
  { className, variant = "default", size = "md", ...props },
  ref,
) {
  return (
    <UITextarea
      ref={ref}
      {...props}
      className={textareaStyle({ variant, class: className })}
      context={{ size }}
    />
  );
});

type ITextareaInputProps = React.ComponentProps<typeof UITextarea.Input> &
  VariantProps<typeof textareaInputStyle>;

const TextareaInput = React.forwardRef<
  React.ComponentRef<typeof UITextarea.Input>,
  ITextareaInputProps
>(function TextareaInput({ className, ...props }, ref) {
  const { size: parentSize } = useStyleContext(SCOPE);

  return (
    <UITextarea.Input
      ref={ref}
      {...props}
      textAlignVertical="top"
      className={textareaInputStyle({
        parentVariants: {
          size: parentSize,
        },
        class: className,
      })}
    />
  );
});

Textarea.displayName = "Textarea";
TextareaInput.displayName = "TextareaInput";

export { Textarea, TextareaInput };
