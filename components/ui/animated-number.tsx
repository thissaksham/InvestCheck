"use client";

// 300ms count transition on value changes (§3.7); respects prefers-reduced-motion.

import { useEffect, useRef, useState } from "react";
import { Money } from "./money";

export function AnimatedMoney(props: {
  value: number;
  className?: string;
  compact?: boolean;
  signed?: boolean;
  decimals?: 0 | 2;
}) {
  const { value, ...rest } = props;
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    if (from === value) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const t = Math.min((now - start) / 300, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (value - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <Money value={Math.round(display * 100) / 100} {...rest} />;
}
