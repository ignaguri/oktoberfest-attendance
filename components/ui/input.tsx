import { cn } from "@/lib/utils";
import * as React from "react";

export interface InputProps extends React.ComponentProps<"input"> {
  errorMsg?: string;
  rightElement?: React.ReactNode;
}

function Input({
  className,
  type,
  errorMsg,
  rightElement,
  ...props
}: InputProps) {
  const errorId = React.useId();

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
            errorMsg &&
              "border-red-500 bg-red-50 text-red-900 placeholder:text-red-700 focus-visible:ring-red-500",
            rightElement && "pr-10",
            className,
          )}
          aria-describedby={errorMsg ? errorId : undefined}
          aria-invalid={!!errorMsg}
          {...props}
        />
        {rightElement && (
          <div className="absolute inset-y-0 right-0 flex items-center">
            {rightElement}
          </div>
        )}
      </div>
      {errorMsg && (
        <span id={errorId} className="w-full text-center text-sm text-red-600">
          {errorMsg}
        </span>
      )}
    </div>
  );
}

export { Input };
