import * as React from "react";
import { cn } from "@/lib/utils";

type SliderControlProps = {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  format?: (value: number) => string;
  onChange: (value: number) => void;
  className?: string;
};

export function SliderControl({
  label,
  value,
  min = 0,
  max = 1,
  step = 0.01,
  format = (next) => next.toFixed(2),
  onChange,
  className
}: SliderControlProps) {
  return (
    <label className={cn("grid gap-2", className)}>
      <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono text-primary">{format(value)}</span>
      </span>
      <input
        className="h-2 w-full accent-primary"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
