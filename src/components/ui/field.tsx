import * as React from "react";
import { cn } from "@/lib/utils";

type FieldProps = {
  label: string;
  hint?: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
};

export function Field({ label, hint, children, icon, className }: FieldProps) {
  return (
    <div className={cn("grid gap-2 border-b border-border/80 py-3 last:border-b-0", className)}>
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {icon}
          {label}
        </label>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

export const inputClassName =
  "min-h-10 w-full rounded-md border border-input bg-muted/60 px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/70 focus:ring-2 focus:ring-primary/15";
