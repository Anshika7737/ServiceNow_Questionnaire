"use client";

import { useEffect } from "react";

/** Shows focus rings only after Tab — not on mouse/touch click. */
export function KeyboardFocusProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;

    function enableKeyboardNav(e: KeyboardEvent) {
      if (e.key === "Tab") {
        root.classList.add("keyboard-nav");
      }
    }

    function disableKeyboardNav() {
      root.classList.remove("keyboard-nav");
    }

    window.addEventListener("keydown", enableKeyboardNav);
    window.addEventListener("mousedown", disableKeyboardNav);
    window.addEventListener("touchstart", disableKeyboardNav, { passive: true });

    return () => {
      window.removeEventListener("keydown", enableKeyboardNav);
      window.removeEventListener("mousedown", disableKeyboardNav);
      window.removeEventListener("touchstart", disableKeyboardNav);
    };
  }, []);

  return children;
}
