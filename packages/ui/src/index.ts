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
 * - Import: `import { Button } from "@/components/ui/button"`
 *
 * ### Mobile (React Native/Expo)
 * - Location: `apps/mobile/components/ui/`
 * - Library: React Native components or gluestack-ui
 * - Import: `import { Button } from "@/components/ui/button"`
 *
 * ## Usage Example:
 *
 * ```typescript
 * // Shared types (this package)
 * import type { ButtonProps } from "@prostcounter/ui";
 *
 * // Platform-specific implementation
 * export const Button: React.FC<ButtonProps> = (props) => {
 *   // Web uses Radix UI
 *   // Mobile uses Pressable
 * }
 * ```
 *
 * ## Benefits:
 * - Type safety across platforms
 * - Clear API contracts
 * - Platform-specific optimizations
 * - No forced dependency on React Native Web
 * - Each platform uses its best-in-class libraries
 */

// Export all component type interfaces and variant types
export type {
  AccordionContentProps,
  AccordionItemProps,
  AccordionProps,
  AccordionTriggerProps,
  AccordionType,
  AvatarProps,
  AvatarSize,
  BadgeProps,
  BadgeVariant,
  ButtonProps,
  ButtonSize,
  ButtonVariant,
  CardContentProps,
  CardDescriptionProps,
  CardFooterProps,
  CardHeaderProps,
  CardProps,
  CardTitleProps,
  CheckboxProps,
  DialogContentProps,
  DialogDescriptionProps,
  DialogFooterProps,
  DialogHeaderProps,
  DialogProps,
  DialogTitleProps,
  DialogTriggerProps,
  InputProps,
  InputType,
  LabelProps,
  ProgressProps,
  ScrollAreaProps,
  SelectContentProps,
  SelectItemProps,
  SelectProps,
  SelectTriggerProps,
  SelectValueProps,
  SeparatorOrientation,
  SeparatorProps,
  SwitchProps,
  TextareaProps,
} from "./types/components";

// Re-export utilities (these are platform-agnostic)
export { cn } from "./utils";
