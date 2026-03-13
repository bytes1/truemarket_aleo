"use client";

import { Button } from "@/components/ui/button";

type AirkitButtonProps = {
  label?: string;
  onClick?: () => void;
  className?: string;
};

export function AirkitButton({
  label = "Open",
  onClick,
  className,
}: AirkitButtonProps) {
  return (
    <Button type="button" onClick={onClick} className={className}>
      {label}
    </Button>
  );
}
