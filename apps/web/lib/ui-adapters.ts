/**
 * UI Contract Adapters
 *
 * These utilities map @prostcounter/ui contract props (Gluestack-style)
 * to shadcn/ui props used in the web implementation.
 *
 * This allows web components to accept contract-compliant props while
 * internally using shadcn/ui's variant system.
 */

import type {
  BadgeAction,
  BadgeVariant as ContractBadgeVariant,
  ButtonAction,
  ButtonSize as ContractButtonSize,
  ButtonVariant as ContractButtonVariant,
} from "@prostcounter/ui";

// ============================================================================
// Button Adapter
// ============================================================================

/**
 * shadcn/ui button variants used in web implementation
 */
export type ShadcnButtonVariant =
  | "default"
  | "destructive"
  | "outline"
  | "secondary"
  | "ghost"
  | "link"
  | "yellow"
  | "yellowOutline"
  | "darkYellow";

/**
 * shadcn/ui button sizes used in web implementation
 */
export type ShadcnButtonSize = "default" | "sm" | "lg" | "icon";

/**
 * Maps contract button action + variant to shadcn variant
 *
 * Mapping logic:
 * - action="primary" + variant="solid" → "yellow" (brand color)
 * - action="primary" + variant="outline" → "yellowOutline"
 * - action="primaryDark" + variant="solid" → "darkYellow"
 * - action="negative" + variant="solid" → "destructive"
 * - action="secondary" + variant="solid" → "secondary"
 * - action="positive" + variant="solid" → "default" (no green variant in shadcn)
 * - variant="ghost" → "ghost"
 * - variant="link" → "link"
 * - variant="outline" (without primary action) → "outline"
 */
export function mapButtonVariant(
  action?: ButtonAction,
  variant?: ContractButtonVariant,
): ShadcnButtonVariant {
  // Handle variant-only mappings first
  if (variant === "ghost") return "ghost";
  if (variant === "link") return "link";

  // Handle action + variant combinations
  switch (action) {
    case "primary":
      return variant === "outline" ? "yellowOutline" : "yellow";
    case "primaryDark":
      return "darkYellow";
    case "negative":
      return "destructive";
    case "secondary":
      return variant === "outline" ? "outline" : "secondary";
    case "positive":
      return "default"; // No green button variant in shadcn
    case "default":
    default:
      // Default action with outline variant
      if (variant === "outline") return "outline";
      // Default solid
      return "default";
  }
}

/**
 * Maps contract button size to shadcn size
 *
 * Contract: xs, sm, md, lg, xl, icon
 * shadcn: default, sm, lg, icon
 */
export function mapButtonSize(size?: ContractButtonSize): ShadcnButtonSize {
  switch (size) {
    case "xs":
    case "sm":
      return "sm";
    case "lg":
    case "xl":
      return "lg";
    case "icon":
      return "icon";
    case "md":
    default:
      return "default";
  }
}

// ============================================================================
// Badge Adapter
// ============================================================================

/**
 * shadcn/ui badge variants used in web implementation
 */
export type ShadcnBadgeVariant =
  | "default"
  | "success"
  | "secondary"
  | "destructive"
  | "outline";

/**
 * Maps contract badge action + variant to shadcn variant
 *
 * Mapping logic:
 * - action="error" → "destructive"
 * - action="success" → "success"
 * - action="warning" → "default" (no warning variant, use default)
 * - action="info" → "default"
 * - action="muted" → "secondary"
 * - variant="outline" → "outline"
 */
export function mapBadgeVariant(
  action?: BadgeAction,
  variant?: ContractBadgeVariant,
): ShadcnBadgeVariant {
  // Outline variant takes precedence
  if (variant === "outline") return "outline";

  // Map action to shadcn variant
  switch (action) {
    case "error":
      return "destructive";
    case "success":
      return "success";
    case "muted":
      return "secondary";
    case "warning":
    case "info":
    default:
      return "default";
  }
}

/**
 * Helper to convert contract BadgeAction to web's expected variant
 * Used by components that need to pass badge variants directly
 */
export function badgeActionToVariant(action: BadgeAction): ShadcnBadgeVariant {
  return mapBadgeVariant(action, "solid");
}
