import type {
  BadgeAction,
  BadgeVariant as ContractBadgeVariant,
} from "@prostcounter/ui";
import { cva } from "class-variance-authority";
import { Slot as SlotPrimitive } from "radix-ui";
import * as React from "react";

import { mapBadgeVariant, type ShadcnBadgeVariant } from "@/lib/ui-adapters";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow-sm hover:bg-primary/80",
        success:
          "border-transparent bg-green-600 text-green-100 shadow-sm hover:bg-green-600/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20",
        outline:
          "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

/**
 * Badge props supporting both contract API and shadcn API
 *
 * Contract API (Gluestack-style):
 * - action: "error" | "warning" | "success" | "info" | "muted"
 * - variant: "solid" | "outline"
 *
 * shadcn API (backward compatible):
 * - variant: "default" | "success" | "secondary" | "destructive" | "outline"
 */
interface BadgeProps extends React.ComponentProps<"span"> {
  // Contract props (Gluestack-style)
  action?: BadgeAction;
  /** Contract variant or shadcn variant */
  variant?: ContractBadgeVariant | ShadcnBadgeVariant;
  // shadcn-specific props
  asChild?: boolean;
}

function Badge({
  className,
  action,
  variant,
  asChild = false,
  ...props
}: BadgeProps) {
  const Comp = asChild ? SlotPrimitive.Slot : "span";

  // Determine final variant: if action is provided, use contract mapping
  // Otherwise, use variant directly (shadcn style)
  const finalVariant: ShadcnBadgeVariant = action
    ? mapBadgeVariant(action, variant as ContractBadgeVariant)
    : ((variant as ShadcnBadgeVariant) ?? "default");

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant: finalVariant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
