import type { TextareaProps as TextareaPropsContract } from "@prostcounter/ui";
import * as React from "react";

import { cn } from "@/lib/utils";

// Extend the contract with web-specific implementation props
export interface TextareaProps
  extends
    Omit<React.ComponentProps<"textarea">, keyof TextareaPropsContract>,
    TextareaPropsContract {}

function Textarea({ className, errorMsg, ...props }: TextareaProps) {
  const errorId = React.useId();

  return (
    <div className="w-full">
      <textarea
        data-slot="textarea"
        className={cn(
          "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 aria-invalid:border-destructive flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          errorMsg &&
            "border-red-500 bg-red-50 text-red-900 placeholder:text-red-700 focus-visible:ring-red-500",
          className,
        )}
        aria-describedby={errorMsg ? errorId : undefined}
        aria-invalid={!!errorMsg}
        {...props}
      />
      {errorMsg && (
        <span id={errorId} className="w-full text-center text-sm text-red-600">
          {errorMsg}
        </span>
      )}
    </div>
  );
}

export { Textarea };
