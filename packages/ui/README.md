# @prostcounter/ui - Shared UI Component Contracts

This package provides **TypeScript interface contracts** for UI components shared between web and mobile platforms. It enables type-safe component APIs across different UI library implementations.

## Architecture Overview

```
packages/ui/                    # TypeScript contracts only
├── src/
│   ├── types/
│   │   └── components.ts      # Component interface definitions
│   ├── utils.ts               # Platform-agnostic utilities (cn)
│   └── index.ts               # Exports
│
apps/web/components/ui/         # shadcn/ui implementations (Radix UI + Tailwind)
├── button.tsx
├── input.tsx
├── avatar.tsx
└── ...

apps/mobile/components/ui/      # gluestack-ui v3 implementations (React Native)
├── button.tsx
├── input.tsx
├── avatar.tsx
└── ...
```

## Key Principles

1. **Contract-Based Architecture**: This package exports only TypeScript interfaces, not implementations
2. **Platform-Specific Implementations**: Each platform uses its best-in-class UI library
3. **Type Safety**: Shared types ensure consistent APIs across platforms
4. **No Forced Dependencies**: Web doesn't need React Native, mobile doesn't need DOM libraries

## Platform Implementations

### Web (Next.js)

- **Location**: `apps/web/components/ui/`
- **Library**: [shadcn/ui](https://ui.shadcn.com/) (Radix UI + Tailwind CSS)
- **Import Pattern**: `import { Button } from "@/components/ui/button"`

**Example**:
```tsx
// apps/web/components/ui/button.tsx
import type { ButtonProps } from "@prostcounter/ui";

export const Button: React.FC<ButtonProps> = ({ variant, size, children, ...props }) => {
  return (
    <RadixButton className={buttonVariants({ variant, size })} {...props}>
      {children}
    </RadixButton>
  );
};
```

### Mobile (React Native/Expo)

- **Location**: `apps/mobile/components/ui/`
- **Library**: [gluestack-ui v3](https://gluestack.io/) (React Native components)
- **Import Pattern**: `import { Button } from "@/components/ui/button"`

**Example**:
```tsx
// apps/mobile/components/ui/button.tsx
import type { ButtonProps } from "@prostcounter/ui";
import { Button as GButton, ButtonText } from "@gluestack-ui/themed";

export const Button: React.FC<ButtonProps> = ({ variant, children, ...props }) => {
  return (
    <GButton sx={{ variant: variant }}>
      <ButtonText>{children}</ButtonText>
    </GButton>
  );
};
```

## Component Contracts

All component interfaces are defined in `src/types/components.ts`. Each contract specifies:

- **Props**: Required and optional properties
- **Events**: Callbacks and handlers
- **Variants**: Style variations (e.g., `variant`, `size`)
- **Children**: Content rendering patterns

### Example Contract

```typescript
// packages/ui/src/types/components.ts

// Variant types are exported separately for reusability
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
  onClick?: (event?: any) => void;
  children?: ReactNode;
  className?: string; // Web uses this, mobile ignores it
}
```

**Using variant types elsewhere:**
```typescript
import type { BadgeVariant } from "@prostcounter/ui";

function getFestivalBadge(status: string): BadgeVariant {
  return status === "active" ? "success" : "default";
}
```

## Adding New Components

### 1. Define the Contract

Add the interface to `packages/ui/src/types/components.ts`:

```typescript
export interface NewComponentProps {
  // Define the API contract
  variant?: "primary" | "secondary";
  onAction?: () => void;
  children: ReactNode;
  className?: string;
}
```

### 2. Export the Contract

Add to `packages/ui/src/index.ts`:

```typescript
export type { NewComponentProps } from "./types/components";
```

### 3. Implement for Web

Create `apps/web/components/ui/new-component.tsx`:

```tsx
import type { NewComponentProps } from "@prostcounter/ui";

export const NewComponent: React.FC<NewComponentProps> = (props) => {
  // shadcn/ui or custom Radix UI implementation
};
```

### 4. Implement for Mobile

Create `apps/mobile/components/ui/new-component.tsx`:

```tsx
import type { NewComponentProps } from "@prostcounter/ui";

export const NewComponent: React.FC<NewComponentProps> = (props) => {
  // gluestack-ui or React Native implementation
};
```

## Shared Utilities

The `cn()` utility is platform-agnostic and re-exported from this package:

```typescript
import { cn } from "@prostcounter/ui";

// Usage (works on both web and mobile)
const className = cn("base-class", condition && "conditional-class");
```

## Exported Variant Types

All variant types are exported separately for reusability in business logic:

```typescript
import type {
  ButtonVariant,
  ButtonSize,
  BadgeVariant,
  InputType,
  AvatarSize,
  AccordionType,
  SeparatorOrientation,
} from "@prostcounter/ui";
```

**Use cases:**
- Type-safe helper functions
- API response typing
- State management
- Business logic validation

**Example:**
```typescript
import type { BadgeVariant } from "@prostcounter/ui";

interface Festival {
  name: string;
  status: "upcoming" | "active" | "ended";
}

function getFestivalBadgeVariant(status: Festival["status"]): BadgeVariant {
  switch (status) {
    case "active":
      return "success";
    case "ended":
      return "secondary";
    default:
      return "default";
  }
}
```

## Benefits

1. **Type Safety**: Catch API mismatches at compile time
2. **Platform Flexibility**: Each platform uses its optimal UI library
3. **No Bloat**: Web doesn't bundle React Native code, vice versa
4. **Clear Contracts**: Documented component APIs
5. **Easy Migration**: Change implementations without breaking consumers
6. **Developer Experience**: IntelliSense and autocomplete across platforms

## Available Components

| Component     | Web Library   | Mobile Library | Contract Status |
|---------------|---------------|----------------|-----------------|
| Button        | Radix UI      | gluestack-ui   | ✅ Defined      |
| Input         | Radix UI      | gluestack-ui   | ✅ Defined      |
| Textarea      | Radix UI      | gluestack-ui   | ✅ Defined      |
| Switch        | Radix UI      | gluestack-ui   | ✅ Defined      |
| Checkbox      | Radix UI      | gluestack-ui   | ✅ Defined      |
| Label         | Radix UI      | gluestack-ui   | ✅ Defined      |
| Badge         | Custom        | gluestack-ui   | ✅ Defined      |
| Avatar        | Radix UI      | gluestack-ui   | ✅ Defined      |
| Card          | Custom        | gluestack-ui   | ✅ Defined      |
| Dialog        | Radix UI      | gluestack-ui   | ✅ Defined      |
| Select        | Radix UI      | gluestack-ui   | ✅ Defined      |
| Accordion     | Radix UI      | gluestack-ui   | ✅ Defined      |
| Progress      | Radix UI      | gluestack-ui   | ✅ Defined      |
| Separator     | Custom        | gluestack-ui   | ✅ Defined      |
| ScrollArea    | Radix UI      | ScrollView     | ✅ Defined      |

## Platform-Specific Components

Some components may not have direct equivalents across platforms. In these cases:

- **Calendar**: Web uses `react-day-picker`, mobile uses `react-native-calendars`
- **Command**: Web uses `cmdk`, mobile uses ActionSheet-based implementation
- **Toast**: Web uses `sonner`, mobile uses gluestack Toast

These components have platform-specific files:

```
packages/ui/src/components/calendar/
├── index.ts           # Re-exports based on platform detection
├── calendar.web.tsx   # Web implementation
└── calendar.native.tsx # Mobile implementation
```

## Notes for Mobile Implementation

When implementing mobile UI components with gluestack-ui v3:

1. **Styling**: Use `sx` prop instead of `className`
2. **Design Tokens**: Leverage gluestack's token system for consistency
3. **Compound Components**: Use gluestack's compound pattern (e.g., `Button + ButtonText`)
4. **Accessibility**: gluestack-ui handles React Native accessibility automatically
5. **Future Compatibility**: gluestack-ui v3 may improve Next.js compatibility in future releases

## References

- [shadcn/ui Documentation](https://ui.shadcn.com/)
- [gluestack-ui v3 Documentation](https://gluestack.io/)
- [Radix UI Documentation](https://www.radix-ui.com/)
- [React Native Documentation](https://reactnative.dev/)
