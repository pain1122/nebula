const seen = new Set<string>();
const key = (owner: string) => `checkupino.customizer.seen.v1.${owner}`;

export const shouldIntroduceCustomizer = (owner?: string): boolean => {
  if (!owner || seen.has(owner)) return false;
  try {
    return localStorage.getItem(key(owner)) !== "1";
  } catch {
    return true;
  }
};

export const markCustomizerIntroduced = (owner?: string) => {
  if (!owner) return;
  seen.add(owner);
  try {
    localStorage.setItem(key(owner), "1");
  } catch {
    /* Keep the tab-local fallback. */
  }
};
