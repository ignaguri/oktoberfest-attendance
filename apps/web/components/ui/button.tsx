import {
  mapButtonSize,
  mapButtonVariant,
  type ShadcnButtonSize,
  type ShadcnButtonVariant,
} from "@/lib/ui-adapters";
import { cn } from "@/lib/utils";
import { cva } from "class-variance-authority";
import { Slot as SlotPrimitive } from "radix-ui";
import * as React from "react";

import type {
  ButtonAction,
  ButtonSize as ContractButtonSize,
  ButtonVariant as ContractButtonVariant,
} from "@prostcounter/ui";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        destructive:
          "bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        yellow: "bg-yellow-400 text-primary hover:bg-yellow-500",
        yellowOutline:
          "border border-yellow-400 bg-transparent text-primary hover:bg-yellow-400",
        darkYellow: "bg-yellow-600 text-white hover:bg-yellow-700",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

/**
 * Button props supporting both contract API and shadcn API
 *
 * Contract API (Gluestack-style):
 * - action: "primary" | "primaryDark" | "secondary" | "positive" | "negative" | "default"
 * - variant: "solid" | "outline" | "link" | "ghost"
 * - size: "xs" | "sm" | "md" | "lg" | "xl" | "icon"
 * - isDisabled: boolean
 * - onPress: () => void
 *
 * shadcn API (backward compatible):
 * - variant: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "yellow" | "yellowOutline" | "darkYellow"
 * - size: "default" | "sm" | "lg" | "icon"
 * - disabled: boolean
 * - onClick: () => void
 */
interface ButtonProps extends Omit<React.ComponentProps<"button">, "disabled"> {
  // Contract props (Gluestack-style)
  action?: ButtonAction;
  /** Contract variant - mapped to shadcn variant when action is provided */
  variant?: ContractButtonVariant | ShadcnButtonVariant;
  /** Contract size - mapped to shadcn size */
  size?: ContractButtonSize | ShadcnButtonSize;
  /** Contract disabled prop */
  isDisabled?: boolean;
  /** Contract press handler */
  onPress?: (event?: React.MouseEvent<HTMLButtonElement>) => void;
  // shadcn-specific props
  asChild?: boolean;
  /** Standard disabled prop (alias for isDisabled) */
  disabled?: boolean;
}

function Button({
  className,
  action,
  variant,
  size,
  asChild = false,
  isDisabled,
  disabled,
  onPress,
  onClick,
  ...props
}: ButtonProps) {
  const Comp = asChild ? SlotPrimitive.Slot : "button";

  // Determine final variant: if action is provided, use contract mapping
  // Otherwise, use variant directly (shadcn style)
  const finalVariant: ShadcnButtonVariant = action
    ? mapButtonVariant(action, variant as ContractButtonVariant)
    : ((variant as ShadcnButtonVariant) ?? "default");

  // Map size if it's a contract size, otherwise use directly
  const contractSizes = ["xs", "sm", "md", "lg", "xl", "icon"];
  const finalSize: ShadcnButtonSize = contractSizes.includes(size as string)
    ? mapButtonSize(size as ContractButtonSize)
    : ((size as ShadcnButtonSize) ?? "default");

  // Merge disabled states and click handlers
  const isButtonDisabled = isDisabled ?? disabled;
  const handleClick = onPress ?? onClick;

  return (
    <Comp
      data-slot="button"
      className={cn(
        buttonVariants({ variant: finalVariant, size: finalSize, className }),
      )}
      disabled={isButtonDisabled}
      onClick={handleClick}
      {...props}
    />
  );
}
export { Button, buttonVariants };

// Re-export shadcn variant types for direct CVA usage (e.g., in calendar.tsx)
export type { ShadcnButtonSize, ShadcnButtonVariant };
