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
// Button (Gluestack-style - shared between web and mobile)
// ============================================================================

/**
 * Button action determines the semantic color scheme
 * - primary: Brand color (amber-500 in ProstCounter)
 * - primaryDark: Darker brand color (amber-600, matches web's darkYellow)
 * - secondary: Neutral color (gray)
 * - positive: Success color (green)
 * - negative: Error/danger color (red)
 * - default: Transparent background
 */
export type ButtonAction =
  | "primary"
  | "primaryDark"
  | "secondary"
  | "positive"
  | "negative"
  | "default";

/**
 * Button variant determines the visual style
 * - solid: Filled background with the action color
 * - outline: Transparent background with colored border
 * - link: No background, text only with underline on hover/active
 * - ghost: Transparent background, shows subtle color on hover/active
 */
export type ButtonVariant = "solid" | "outline" | "link" | "ghost";

/**
 * Button size determines height and padding
 * - icon: Square button for icon-only content
 */
export type ButtonSize = "xs" | "sm" | "md" | "lg" | "xl" | "icon";

/**
 * Button group spacing options
 */
export type ButtonGroupSpace =
  | "xs"
  | "sm"
  | "md"
  | "lg"
  | "xl"
  | "2xl"
  | "3xl"
  | "4xl";

/**
 * Gluestack Button Props - used by both web and mobile implementations
 */
export interface ButtonProps {
  /** Semantic color action */
  action?: ButtonAction;
  /** Visual style variant */
  variant?: ButtonVariant;
  /** Size of the button */
  size?: ButtonSize;
  /** Whether the button is disabled */
  isDisabled?: boolean;
  /** Press/click handler */
  onPress?: (event?: any) => void;
  /** Additional className for styling */
  className?: string;
  /** Button content */
  children?: ReactNode;
}

export interface ButtonTextProps {
  /** Additional className for styling */
  className?: string;
  /** Text content */
  children?: ReactNode;
}

export interface ButtonGroupProps {
  /** Gap between buttons */
  space?: ButtonGroupSpace;
  /** Whether buttons are visually attached */
  isAttached?: boolean;
  /** Additional className for styling */
  className?: string;
  /** Button elements */
  children?: ReactNode;
}

// ============================================================================
// Button Color Mapping Contract
// ============================================================================

/**
 * Color mapping contract for button styles.
 * Each platform implements this with their available color tokens.
 *
 * Web uses CSS variables: primary-500, secondary-500, etc.
 * Mobile uses direct Tailwind colors: amber-500, gray-500, etc.
 */
export interface ButtonColorTokens {
  /** Primary action colors (brand) */
  primary: {
    bg: string;
    bgHover: string;
    bgActive: string;
    border: string;
    borderHover: string;
    borderActive: string;
    text: string;
    textHover: string;
    textActive: string;
  };
  /** Secondary action colors (neutral) */
  secondary: {
    bg: string;
    bgHover: string;
    bgActive: string;
    border: string;
    borderHover: string;
    borderActive: string;
    text: string;
    textHover: string;
    textActive: string;
  };
  /** Positive action colors (success) */
  positive: {
    bg: string;
    bgHover: string;
    bgActive: string;
    border: string;
    borderHover: string;
    borderActive: string;
    text: string;
    textHover: string;
    textActive: string;
  };
  /** Negative action colors (error/danger) */
  negative: {
    bg: string;
    bgHover: string;
    bgActive: string;
    border: string;
    borderHover: string;
    borderActive: string;
    text: string;
    textHover: string;
    textActive: string;
  };
  /** Solid variant text color (usually white) */
  solidText: string;
  /** Secondary solid text color (usually dark) */
  secondarySolidText: string;
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

/**
 * Input size determines height
 */
export type InputSize = "sm" | "md" | "lg" | "xl";

/**
 * Input variant determines the visual style
 * - outline: Standard bordered input
 * - underlined: Only bottom border
 * - rounded: Fully rounded corners
 */
export type InputVariant = "outline" | "underlined" | "rounded";

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

/**
 * Textarea size determines text size
 */
export type TextareaSize = "sm" | "md" | "lg" | "xl";

/**
 * Textarea variant determines the visual style
 */
export type TextareaVariant = "default";

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

/**
 * Switch size determines scale
 */
export type SwitchSize = "sm" | "md" | "lg";

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

/**
 * Checkbox size determines indicator and label size
 */
export type CheckboxSize = "sm" | "md" | "lg";

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
// Badge (Gluestack-style - shared between web and mobile)
// ============================================================================

/**
 * Badge action determines the semantic color scheme
 * - error: Error/danger color (red)
 * - warning: Warning color (orange/yellow)
 * - success: Success color (green)
 * - info: Information color (blue)
 * - muted: Neutral/muted color (gray)
 */
export type BadgeAction = "error" | "warning" | "success" | "info" | "muted";

/**
 * Badge variant determines the visual style
 * - solid: Filled background with the action color
 * - outline: Transparent background with colored border
 */
export type BadgeVariant = "solid" | "outline";

/**
 * Badge size determines text and padding
 */
export type BadgeSize = "sm" | "md" | "lg";

/**
 * Gluestack Badge Props - used by both web and mobile implementations
 */
export interface BadgeProps {
  /** Semantic color action */
  action?: BadgeAction;
  /** Visual style variant */
  variant?: BadgeVariant;
  /** Size of the badge */
  size?: BadgeSize;
  /** Additional className for styling */
  className?: string;
  /** Badge content */
  children?: ReactNode;
}

export interface BadgeTextProps {
  /** Additional className for styling */
  className?: string;
  /** Text content */
  children?: ReactNode;
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

/**
 * Card size determines padding and border radius
 */
export type CardSize = "sm" | "md" | "lg";

/**
 * Card variant determines the visual style
 * - elevated: Subtle background (default)
 * - outline: Border with transparent background
 * - ghost: No styling (transparent)
 * - filled: Filled background
 */
export type CardVariant = "elevated" | "outline" | "ghost" | "filled";

export interface CardProps {
  /** Size of the card - from contract */
  size?: CardSize;
  /** Variant style of the card - from contract */
  variant?: CardVariant;
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

/**
 * Dialog/Modal size determines width
 */
export type DialogSize = "xs" | "sm" | "md" | "lg" | "full";

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

/**
 * Select size determines height and text size
 */
export type SelectSize = "sm" | "md" | "lg" | "xl";

/**
 * Select variant determines the visual style
 * - outline: Standard bordered select
 * - underlined: Only bottom border
 * - rounded: Fully rounded corners
 */
export type SelectVariant = "outline" | "underlined" | "rounded";

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
// Progress (Gluestack-style - shared between web and mobile)
// ============================================================================

/**
 * Progress size determines the height/width of the progress bar
 */
export type ProgressSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

/**
 * Progress orientation determines if progress is horizontal or vertical
 */
export type ProgressOrientation = "horizontal" | "vertical";

export interface ProgressProps {
  /** Current progress value (0-100 by default) */
  value?: number;
  /** Maximum progress value */
  max?: number;
  /** Size of the progress bar - from contract */
  size?: ProgressSize;
  /** Orientation of the progress bar */
  orientation?: ProgressOrientation;
  /** Additional className for styling */
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
