/**
 * @prostcounter/ui - Shared UI Component Contracts
 *
 * This package exports TypeScript interfaces that define the API contracts
 * for UI components shared across web and mobile platforms.
 *
 * ## Platform Implementations:
 *
 * ### Web (Next.js)
 * - Location: `apps/web/components/ui/`
 * - Library: shadcn/ui (Radix UI + Tailwind CSS)
 *
 * ### Mobile (React Native/Expo)
 * - Location: `apps/mobile/components/ui/`
 * - Library: Gluestack UI v3 + NativeWind v5
 *
 * ## Usage Example:
 *
 * ```typescript
 * // Import shared types
 * import type { ButtonProps, ButtonAction } from "@prostcounter/ui";
 *
 * // Platform-specific implementation uses the shared types
 * ```
 */

// Export all component type interfaces and variant types
export type {
  // Accordion
  AccordionContentProps,
  AccordionItemProps,
  AccordionProps,
  AccordionTriggerProps,
  AccordionType,
  // Avatar
  AvatarProps,
  AvatarSize,
  // Badge (Gluestack-style)
  BadgeAction,
  BadgeProps,
  BadgeSize,
  BadgeTextProps,
  BadgeVariant,
  // Button (Gluestack-style)
  ButtonAction,
  ButtonColorTokens,
  ButtonGroupProps,
  ButtonGroupSpace,
  ButtonProps,
  ButtonSize,
  ButtonTextProps,
  ButtonVariant,
  // Card (Gluestack-style)
  CardContentProps,
  CardDescriptionProps,
  CardFooterProps,
  CardHeaderProps,
  CardProps,
  CardSize,
  CardTitleProps,
  CardVariant,
  // Checkbox (Gluestack-style)
  CheckboxProps,
  CheckboxSize,
  // Dialog/Modal (Gluestack-style)
  DialogContentProps,
  DialogDescriptionProps,
  DialogFooterProps,
  DialogHeaderProps,
  DialogProps,
  DialogSize,
  DialogTitleProps,
  DialogTriggerProps,
  // Input (Gluestack-style)
  InputProps,
  InputSize,
  InputType,
  InputVariant,
  // Label
  LabelProps,
  // Progress (Gluestack-style)
  ProgressOrientation,
  ProgressProps,
  ProgressSize,
  // ScrollArea
  ScrollAreaProps,
  // Select (Gluestack-style)
  SelectContentProps,
  SelectItemProps,
  SelectProps,
  SelectSize,
  SelectTriggerProps,
  SelectValueProps,
  SelectVariant,
  // Separator
  SeparatorOrientation,
  SeparatorProps,
  // Switch (Gluestack-style)
  SwitchProps,
  SwitchSize,
  // Textarea (Gluestack-style)
  TextareaProps,
  TextareaSize,
  TextareaVariant,
} from "./types/components";

// Re-export utilities (platform-agnostic)
export { cn, getInitials } from "./utils";
