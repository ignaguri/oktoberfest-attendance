import { cn } from "@/lib/utils";

/**
 * The filling-mug loader for page and section loading. Inline and button
 * loading keeps lucide's Loader2: below ~32px the fill is illegible, and the
 * mug's art cannot take a text colour. Styles and animation live in the
 * .mug-loader rules in styles/globals.css.
 */
function MugLoader({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("mug-loader", className)} {...props} />;
}

export { MugLoader };
