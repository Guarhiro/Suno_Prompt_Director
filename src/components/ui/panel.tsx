import * as React from "react";
import { cn } from "@/lib/utils";

type PanelProps = React.HTMLAttributes<HTMLDivElement>;

export function Panel({ className, ...props }: PanelProps) {
  return (
    <section
      className={cn(
        "rounded-lg border border-border bg-panel shadow-console",
        className
      )}
      {...props}
    />
  );
}

export function PanelHeader({ className, ...props }: PanelProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-b border-border px-4 py-3",
        className
      )}
      {...props}
    />
  );
}

export function PanelBody({ className, ...props }: PanelProps) {
  return <div className={cn("p-4", className)} {...props} />;
}
