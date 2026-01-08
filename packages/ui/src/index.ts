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
  // Badge
  BadgeProps,
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
  // Card
  CardContentProps,
  CardDescriptionProps,
  CardFooterProps,
  CardHeaderProps,
  CardProps,
  CardTitleProps,
  // Checkbox
  CheckboxProps,
  // Dialog/Modal
  DialogContentProps,
  DialogDescriptionProps,
  DialogFooterProps,
  DialogHeaderProps,
  DialogProps,
  DialogTitleProps,
  DialogTriggerProps,
  // Input
  InputProps,
  InputType,
  // Label
  LabelProps,
  // Progress
  ProgressProps,
  // ScrollArea
  ScrollAreaProps,
  // Select
  SelectContentProps,
  SelectItemProps,
  SelectProps,
  SelectTriggerProps,
  SelectValueProps,
  // Separator
  SeparatorOrientation,
  SeparatorProps,
  // Switch
  SwitchProps,
  // Textarea
  TextareaProps,
} from "./types/components";

// Re-export utilities (platform-agnostic)
export { cn } from "./utils";
