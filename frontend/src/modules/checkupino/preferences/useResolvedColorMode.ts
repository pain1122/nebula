import { useEffect, useReducer } from "react";

import { applyColorPreference, type ColorPreference, resolveColorPreference } from "../../../core";

const colorSchemeQuery = "(prefers-color-scheme: dark)";

const readSystemPrefersDark = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(colorSchemeQuery).matches
    : false;

export const useResolvedColorMode = (preference: ColorPreference) => {
  const [, refreshSystemPreference] = useReducer((revision: number) => revision + 1, 0);
  const prefersDark = readSystemPrefersDark();

  useEffect(() => {
    if (
      preference !== "system" ||
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return undefined;
    }

    const mediaQuery = window.matchMedia(colorSchemeQuery);
    const handleChange = () => refreshSystemPreference();
    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [preference]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      applyColorPreference(document.documentElement, preference, prefersDark);
    }
  }, [preference, prefersDark]);

  return resolveColorPreference(preference, prefersDark);
};
