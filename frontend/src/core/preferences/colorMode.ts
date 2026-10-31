export const colorPreferences = ["system", "light", "dark"] as const;

export type ColorPreference = (typeof colorPreferences)[number];
export type ResolvedColorMode = Exclude<ColorPreference, "system">;

export const isColorPreference = (value: unknown): value is ColorPreference =>
  typeof value === "string" && colorPreferences.includes(value as ColorPreference);

export const normalizeColorPreference = (
  value: unknown,
  fallback: ColorPreference = "system",
): ColorPreference => (isColorPreference(value) ? value : fallback);

export const resolveColorPreference = (
  preference: ColorPreference,
  prefersDark: boolean,
): ResolvedColorMode => (preference === "system" ? (prefersDark ? "dark" : "light") : preference);

export const applyColorPreference = (
  root: HTMLElement,
  preference: ColorPreference,
  prefersDark: boolean,
) => {
  const resolvedMode = resolveColorPreference(preference, prefersDark);
  root.setAttribute("data-bs-theme", resolvedMode);
  root.style.colorScheme = resolvedMode;
  return resolvedMode;
};
