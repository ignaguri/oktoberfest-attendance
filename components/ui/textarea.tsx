import { cn } from "@/lib/utils";
import * as React from "react";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  errorMsg?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, errorMsg, ...props }, ref) => {
    return (
      <>
        <textarea
          className={cn(
            "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            errorMsg &&
              "border-red-500 bg-red-50 text-red-900 placeholder:text-red-700 focus-visible:ring-red-500",
            className,
          )}
          ref={ref}
          {...props}
        />
        {errorMsg && (
          <span className="w-full text-center text-sm text-red-600">
            {errorMsg}
          </span>
        )}
      </>
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
