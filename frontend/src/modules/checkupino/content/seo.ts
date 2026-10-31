import { z } from "../forms";

export type ArticleSeo = {
  title: string;
  description: string;
  keywords: string;
  schema_json: string;
  canonical_url: string;
};
export const emptySeo = (): ArticleSeo => ({
  title: "",
  description: "",
  keywords: "",
  schema_json: "",
  canonical_url: "",
});
export const seoCharacters = (value: string) => Array.from(value).length;
const hasControls = (value: string, allWhitespace = false) =>
  Array.from(value).some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code === 127 || (code < 32 && (allWhitespace || ![9, 10, 13].includes(code)));
  });
// Editorial guidance, not Google limits. Google truncates according to display width.
export const seoRanges = { title: [50, 60], description: [120, 160] } as const;
export function seoCounterTone(value: string, kind: keyof typeof seoRanges) {
  const count = seoCharacters(value),
    [min, max] = seoRanges[kind];
  return count > max ? "text-danger" : count >= min ? "text-success" : "text-body";
}
export function validCanonical(value: string) {
  if (!value.trim()) return true;
  try {
    const url = new URL(value.trim());
    return (
      url.protocol === "https:" &&
      !!url.hostname &&
      !url.username &&
      !url.password &&
      !value.includes("#") &&
      !/[\s\\]/.test(value.trim()) &&
      !hasControls(value.trim(), true)
    );
  } catch {
    return false;
  }
}
export function validSchemaJson(value: string) {
  if (!value.trim()) return true;
  if (/[<>]/.test(value)) return false;
  try {
    const data: unknown = JSON.parse(value);
    const object = (v: unknown): v is Record<string, unknown> =>
      !!v && typeof v === "object" && !Array.isArray(v);
    const roots: unknown[] = Array.isArray(data) ? data : [data];
    if (
      !roots.length ||
      !roots.every(
        (v) =>
          object(v) &&
          ["https://schema.org", "https://schema.org/"].includes(String(v["@context"])) &&
          ("@type" in v || "@graph" in v),
      )
    )
      return false;
    let nodes = 0;
    const walk = (v: unknown, depth: number): boolean => {
      if (++nodes > 1000 || depth > 14) return false;
      return (
        !v ||
        typeof v !== "object" ||
        Object.entries(v).every(
          ([k, item]) =>
            !["__proto__", "constructor", "prototype"].includes(k) &&
            (k !== "@context" || item === "https://schema.org" || item === "https://schema.org/") &&
            walk(item, depth + 1),
        )
      );
    };
    return walk(data, 0);
  } catch {
    return false;
  }
}
const bounded = (limit: number) =>
  z.string().refine((v) => seoCharacters(v) <= limit && !hasControls(v));
export const seoSchema = z
  .object({
    title: bounded(200),
    description: bounded(1000),
    keywords: bounded(1000),
    schema_json: bounded(20000).refine(validSchemaJson),
    canonical_url: bounded(2048).refine(validCanonical),
  })
  .strict();
export const validSeo = (value: ArticleSeo) => seoSchema.safeParse(value).success;
