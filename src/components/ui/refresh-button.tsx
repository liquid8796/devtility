"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Icon refresh button with guaranteed visual feedback: the icon spins while
 * `loading` is true and for at least ~800ms after every click, so fast
 * responses still show the rotation.
 */
export function RefreshButton({
  onClick,
  loading = false,
  label,
}: {
  onClick: () => void;
  loading?: boolean;
  label: string;
}) {
  const [kick, setKick] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const handleClick = () => {
    setKick(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setKick(false), 800);
    onClick();
  };

  return (
    <Button variant="ghost" size="icon" aria-label={label} title={label} onClick={handleClick}>
      <RefreshCw className={cn("h-4 w-4", (kick || loading) && "animate-spin")} />
    </Button>
  );
}
