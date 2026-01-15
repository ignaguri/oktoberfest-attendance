import { useTranslation } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import * as React from "react";

import type { InputProps as InputPropsContract } from "@prostcounter/ui";

// Extend the contract with web-specific implementation props
export interface InputProps
  extends
    Omit<React.ComponentProps<"input">, keyof InputPropsContract>,
    InputPropsContract {
  rightElement?: React.ReactNode;
}

/**
 * Check if a string looks like a translation key (e.g., "validation.groupName.required")
 */
function isTranslationKey(str: string): boolean {
  return /^[a-zA-Z]+(\.[a-zA-Z_]+)+$/.test(str);
}

function Input({
  className,
  type,
  errorMsg,
  rightElement,
  ...props
}: InputProps) {
  const { t } = useTranslation();
  const errorId = React.useId();

  // Translate error message if it looks like a translation key
  const translatedErrorMsg =
    errorMsg && isTranslationKey(errorMsg) ? t(errorMsg) : errorMsg;

  return (
    <div className="w-full">
      <div className="relative">
        <input
          type={type}
          data-slot="input"
          className={cn(
            "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            "aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
            translatedErrorMsg &&
              "border-red-500 bg-red-50 text-red-900 placeholder:text-red-700 focus-visible:ring-red-500",
            rightElement && "pr-10",
            className,
          )}
          aria-describedby={translatedErrorMsg ? errorId : undefined}
          aria-invalid={!!translatedErrorMsg}
          {...props}
        />
        {rightElement && (
          <div className="absolute inset-y-0 right-0 flex items-center">
            {rightElement}
          </div>
        )}
      </div>
      {translatedErrorMsg && (
        <span id={errorId} className="w-full text-center text-sm text-red-600">
          {translatedErrorMsg}
        </span>
      )}
    </div>
  );
}

export { Input };
