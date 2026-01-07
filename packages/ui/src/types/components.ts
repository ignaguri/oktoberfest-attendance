/**
 * UI Component Contracts
 *
 * These interfaces define the API contract for shared UI components.
 * Each platform (web, mobile) implements these interfaces with their own component libraries:
 * - Web: shadcn/ui (Radix UI + Tailwind)
 * - Mobile: React Native components or gluestack-ui
 *
 * @example
 * // Web implementation (apps/web/components/ui/button.tsx)
 * export const Button: React.FC<ButtonProps> = ({ variant, size, children, ...props }) => {
 *   return <RadixButton className={buttonVariants({ variant, size })} {...props}>{children}</RadixButton>
 * }
 *
 * // Mobile implementation (apps/mobile/components/ui/button.tsx)
 * export const Button: React.FC<ButtonProps> = ({ variant, size, children, ...props }) => {
 *   return <Pressable style={buttonStyles[variant]} {...props}><Text>{children}</Text></Pressable>
 * }
 */

import type { ReactNode } from "react";

// ============================================================================
// Button
// ============================================================================

export type ButtonVariant =
  | "default"
  | "destructive"
  | "outline"
  | "secondary"
  | "ghost"
  | "link"
  | "yellow"
  | "yellowOutline"
  | "darkYellow";

export type ButtonSize = "default" | "sm" | "lg" | "icon";

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  onClick?: (event?: any) => void; // Flexible to support both web (MouseEvent) and mobile (Pressable onPress)
  children?: ReactNode; // Optional to support icon-only buttons
  className?: string;
}

// ============================================================================
// Input
// ============================================================================

export type InputType =
  | "text"
  | "password"
  | "email"
  | "number"
  | "tel"
  | "url"
  | "date"
  | "file";

export interface InputProps {
  id?: string;
  name?: string;
  type?: InputType;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  readOnly?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
  onChange?: (e: any) => void; // Flexible to support both web (ChangeEvent) and mobile (TextInput onChangeText)
  onBlur?: (e: any) => void;
  onFocus?: (e: any) => void;
  onKeyDown?: (e: any) => void;
  errorMsg?: string;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  className?: string;
  rows?: number;
  autoComplete?: string;
  accept?: string; // For file inputs
}

// ============================================================================
// Textarea
// ============================================================================

export interface TextareaProps {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  readOnly?: boolean;
  rows?: number;
  maxLength?: number;
  onChange?: (e: any) => void; // Flexible to support both web (ChangeEvent) and mobile (TextInput onChangeText)
  onBlur?: (e: any) => void;
  onFocus?: (e: any) => void;
  errorMsg?: string;
  className?: string;
}

// ============================================================================
// Switch
// ============================================================================

export interface SwitchProps {
  id?: string;
  checked?: boolean;
  disabled?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
}

// ============================================================================
// Checkbox
// ============================================================================

export interface CheckboxProps {
  id?: string;
  checked?: boolean;
  disabled?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  value?: string;
  className?: string;
  children?: ReactNode;
}

// ============================================================================
// Label
// ============================================================================

export interface LabelProps {
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}

// ============================================================================
// Badge
// ============================================================================

export type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success";

export interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant | null;
  className?: string;
}

// ============================================================================
// Avatar
// ============================================================================

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

export interface AvatarProps {
  url: string | null;
  fallback: {
    username: string | null;
    full_name: string | null;
    email: string;
  };
  size?: AvatarSize;
  onPress?: () => void;
  className?: string;
}

// ============================================================================
// Card
// ============================================================================

export interface CardProps {
  children: ReactNode;
  className?: string;
}

export interface CardHeaderProps {
  children: ReactNode;
  className?: string;
}

export interface CardTitleProps {
  children: ReactNode;
  className?: string;
}

export interface CardDescriptionProps {
  children: ReactNode;
  className?: string;
}

export interface CardContentProps {
  children: ReactNode;
  className?: string;
}

export interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

// ============================================================================
// Dialog/Modal
// ============================================================================

export interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

export interface DialogTriggerProps {
  children: ReactNode;
  asChild?: boolean;
}

export interface DialogContentProps {
  children: ReactNode;
  className?: string;
}

export interface DialogHeaderProps {
  children: ReactNode;
  className?: string;
}

export interface DialogFooterProps {
  children: ReactNode;
  className?: string;
}

export interface DialogTitleProps {
  children: ReactNode;
  className?: string;
}

export interface DialogDescriptionProps {
  children: ReactNode;
  className?: string;
}

// ============================================================================
// Select/Dropdown
// ============================================================================

export interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  children: ReactNode;
}

export interface SelectTriggerProps {
  children: ReactNode;
  className?: string;
}

export interface SelectContentProps {
  children: ReactNode;
  className?: string;
}

export interface SelectItemProps {
  value: string;
  children: ReactNode;
  disabled?: boolean;
}

export interface SelectValueProps {
  placeholder?: string;
}

// ============================================================================
// Accordion
// ============================================================================

export type AccordionType = "single" | "multiple";

export interface AccordionProps {
  type: AccordionType;
  collapsible?: boolean;
  children: ReactNode;
  className?: string;
}

export interface AccordionItemProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export interface AccordionTriggerProps {
  children: ReactNode;
  className?: string;
}

export interface AccordionContentProps {
  children: ReactNode;
  className?: string;
}

// ============================================================================
// Progress
// ============================================================================

export interface ProgressProps {
  value?: number;
  max?: number;
  className?: string;
}

// ============================================================================
// Separator
// ============================================================================

export type SeparatorOrientation = "horizontal" | "vertical";

export interface SeparatorProps {
  orientation?: SeparatorOrientation;
  className?: string;
}

// ============================================================================
// ScrollArea
// ============================================================================

export interface ScrollAreaProps {
  children: ReactNode;
  className?: string;
}
