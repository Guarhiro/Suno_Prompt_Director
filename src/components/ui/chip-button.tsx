import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type ChipButtonProps = {
  active?: boolean;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export function ChipButton({ active, children, className, ...props }: ChipButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 rounded-md border px-3 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
        active
          ? "border-primary bg-primary/15 text-primary"
          : "border-border bg-muted/50 text-muted-foreground hover:border-primary/40 hover:text-foreground",
        className
      )}
      {...props}
    >
      {active ? <Check className="size-3.5" /> : null}
      {children}
    </button>
  );
}
