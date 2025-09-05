import { cn } from "@/lib/utils";
import * as React from "react";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  errorMsg?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, errorMsg, ...props }, ref) => {
    const errorId = React.useId();

    return (
      <>
        <input
          type={type}
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            errorMsg &&
              "border-red-500 bg-red-50 text-red-900 placeholder:text-red-700 focus-visible:ring-red-500",
            className,
          )}
          ref={ref}
          aria-describedby={errorMsg ? errorId : undefined}
          {...props}
        />
        {errorMsg && (
          <span
            id={errorId}
            className="w-full text-center text-sm text-red-600"
          >
            {errorMsg}
          </span>
        )}
      </>
    );
  },
);
Input.displayName = "Input";

export { Input };
