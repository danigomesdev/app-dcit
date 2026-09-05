"use client";

import { useEffect, useRef, type ReactNode } from "react";

// A required field inside a closed <details> can silently block form
// submission: the browser can't focus or show its "please fill this field"
// bubble on a hidden element, so clicking Salvar just does nothing with zero
// visible feedback. The `invalid` event fires on every failing field during
// the browser's validation pass (it doesn't bubble, so this listens in the
// capture phase) — opening that field's ancestor <details> synchronously,
// before the browser picks what to focus, lets the native validation bubble
// show up normally instead of failing silently.
export function AutoExpandOnInvalid({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    function handleInvalid(event: Event) {
      const target = event.target as HTMLElement | null;
      const details = target?.closest("details");
      if (details && !details.open) {
        details.open = true;
      }
    }

    container.addEventListener("invalid", handleInvalid, true);
    return () => container.removeEventListener("invalid", handleInvalid, true);
  }, []);

  return <div ref={ref}>{children}</div>;
}
