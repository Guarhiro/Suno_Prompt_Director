"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "./button";

type CopyButtonProps = {
  value: string;
  label?: string;
};

export function CopyButton({ value, label = "コピー" }: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <Button type="button" size="sm" variant={copied ? "primary" : "secondary"} onClick={handleCopy}>
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      {copied ? "コピー済み" : label}
    </Button>
  );
}
