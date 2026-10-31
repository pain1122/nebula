import { z } from "../forms";
import { checkupinoTransport } from "../api/transport";
import { TransportError } from "../api/wire";

export const generalSettingKeys = [
  "booking.pending_hold_minutes",
  "booking.default_timezone",
  "payments.default_currency",
] as const;
export type GeneralSettingKey = (typeof generalSettingKeys)[number];
export type GeneralScope = "platform" | "site";
export type GeneralValue = string | number;
export const generalSettingNames = {
  "booking.pending_hold_minutes": "hold",
  "booking.default_timezone": "timezone",
  "payments.default_currency": "currency",
} as const;
export const validGeneralValue = (
  key: GeneralSettingKey,
  value: unknown,
): value is GeneralValue => {
  if (key === "booking.pending_hold_minutes")
    return typeof value === "number" && Number.isInteger(value) && value >= 5 && value <= 180;
  if (typeof value !== "string") return false;
  if (key === "payments.default_currency") return /^[A-Z]{3}$/.test(value);
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return value.length > 0 && value.length <= 100;
  } catch {
    return false;
  }
};
export const parseGeneralDraft = (key: GeneralSettingKey, text: string): GeneralValue | null => {
  const value =
    key === "booking.pending_hold_minutes" && /^(?:[1-9]\d{0,2})$/.test(text) ? Number(text) : text;
  return validGeneralValue(key, value) ? value : null;
};
const value = z.union([z.string().max(100), z.number().int().safe()]);
const scope = z.enum(["platform", "site"]);
const revision = z.string().regex(/^[a-f0-9]{64}$/);
const rowSchema = z.object({
  key: z.enum(generalSettingKeys),
  value_type: z.enum(["integer", "string"]),
  default: value,
  allowed_scopes: z.array(z.enum(["platform", "site", "user"])),
  scope_type: scope,
  scope_key: z.string().min(1).max(191),
  stored: z.boolean(),
  value: value.nullable(),
  effective_value: value,
  effective_source: z.enum(["platform", "site", "default"]),
  runtime_bound: z.literal(true),
  runtime_source: z.enum([
    "new_reservation_hold",
    "missing_hospital_timezone_only",
    "missing_new_schedule_currency_only",
  ]),
  runtime_default: z.number().int().positive().safe().nullable(),
  constraints: z.union([
    z.object({ min: z.literal(5), max: z.literal(180) }).strict(),
    z.object({ format: z.enum(["iana_timezone", "three_uppercase_letters"]) }).strict(),
  ]),
});
export type GeneralSetting = z.infer<typeof rowSchema>;
export interface GeneralSnapshot {
  readonly scope: GeneralScope;
  readonly revision: string;
  readonly settings: readonly GeneralSetting[];
}
export interface GeneralPair {
  readonly platform: GeneralSnapshot;
  readonly site: GeneralSnapshot;
}
export interface GeneralChange {
  readonly key: GeneralSettingKey;
  readonly scope: GeneralScope;
  readonly operation: "set" | "reset";
  readonly value: GeneralValue | null;
}
export const settingFor = (
  pair: GeneralPair,
  selected: GeneralScope,
  key: GeneralSettingKey,
): GeneralSetting => {
  const row = pair[selected].settings.find((row) => row.key === key);
  if (!row) throw new Error("General setting missing.");
  return row;
};
export const adaptGeneralSnapshot = (wire: unknown, expected: GeneralScope): GeneralSnapshot => {
  const parsed = z
    .object({
      success: z.literal(true),
      data: z.object({ settings: z.array(rowSchema).length(3) }),
      meta: z.object({
        read_only: z.literal(true),
        managed_scopes: z.tuple([z.literal("platform"), z.literal("site")]),
        scope_type: scope,
        revision,
        write_controls_ready: z.literal(true),
        runtime_binding_ready: z.literal(true),
        generated_at: z.iso.datetime({ offset: true }),
      }),
    })
    .parse(wire);
  if (parsed.meta.scope_type !== expected) throw new Error("General scope rejected.");
  for (const [index, row] of parsed.data.settings.entries()) {
    const name = generalSettingNames[row.key];
    const source = {
      hold: "new_reservation_hold",
      timezone: "missing_hospital_timezone_only",
      currency: "missing_new_schedule_currency_only",
    }[name];
    const scopes = name === "timezone" ? ["platform", "site", "user"] : ["platform", "site"];
    if (
      row.key !== generalSettingKeys[index] ||
      row.scope_type !== expected ||
      row.scope_key !== parsed.data.settings[0]?.scope_key ||
      row.value_type !== (name === "hold" ? "integer" : "string") ||
      JSON.stringify(row.allowed_scopes) !== JSON.stringify(scopes) ||
      !validGeneralValue(row.key, row.default) ||
      !validGeneralValue(row.key, row.effective_value) ||
      (row.stored
        ? !validGeneralValue(row.key, row.value) ||
          row.value !== row.effective_value ||
          row.effective_source !== expected
        : row.value !== null || row.effective_source === expected) ||
      (expected === "platform" &&
        !row.stored &&
        (row.effective_source !== "default" || row.effective_value !== row.default)) ||
      (row.effective_source === "default" && row.effective_value !== row.default) ||
      row.runtime_source !== source ||
      (name === "hold"
        ? row.runtime_default === null || !("min" in row.constraints)
        : row.runtime_default !== null ||
          !("format" in row.constraints) ||
          row.constraints.format !==
            (name === "timezone" ? "iana_timezone" : "three_uppercase_letters"))
    )
      throw new Error("General settings binding rejected.");
  }
  return { scope: expected, revision: parsed.meta.revision, settings: parsed.data.settings };
};
const readSnapshot = async (selected: GeneralScope, signal: AbortSignal) => {
  const response = await checkupinoTransport.request<unknown>({
    method: "GET",
    path: "/api/admin/settings/general",
    query: { scope_type: selected },
    signal,
  });
  if (response.status !== 200) throw new Error("General settings response rejected.");
  return adaptGeneralSnapshot(response.data, selected);
};
const conflict = () =>
  new TransportError({
    kind: "http",
    status: 409,
    code: "stale_revision",
    message: null,
    errors: {},
    meta: null,
    correlationId: null,
    retryAfter: null,
  });
export const readGeneralPair = async (signal: AbortSignal): Promise<GeneralPair> => {
  signal.throwIfAborted();
  const [platform, site] = await Promise.all([
    readSnapshot("platform", signal),
    readSnapshot("site", signal),
  ]);
  const verify = await readSnapshot("platform", signal);
  if (JSON.stringify(platform) !== JSON.stringify(verify)) throw conflict();
  for (const key of generalSettingKeys) {
    const p = platform.settings.find((row) => row.key === key)!;
    const s = site.settings.find((row) => row.key === key)!;
    if (
      s.default !== p.default ||
      s.runtime_default !== p.runtime_default ||
      (!s.stored &&
        (s.effective_value !== p.effective_value ||
          s.effective_source !== (p.stored ? "platform" : "default")))
    )
      throw conflict();
  }
  signal.throwIfAborted();
  return { platform, site };
};
export const verifyGeneralPair = async (baseline: GeneralPair, signal: AbortSignal) => {
  const fresh = await readGeneralPair(signal);
  if (JSON.stringify(fresh) !== JSON.stringify(baseline)) throw conflict();
};
export const generalRuntimeValue = (
  pair: GeneralPair,
  key: GeneralSettingKey,
  change?: GeneralChange,
): GeneralValue => {
  const p = settingFor(pair, "platform", key),
    s = settingFor(pair, "site", key);
  const selectedValue = (selected: GeneralScope, row: GeneralSetting) =>
    change?.key === key && change.scope === selected ? change.value : row.value;
  return (
    selectedValue("site", s) ??
    selectedValue("platform", p) ??
    (key === "booking.pending_hold_minutes" ? s.runtime_default! : p.default)
  );
};
export const generalSettingPath = (key: GeneralSettingKey) => {
  if (!generalSettingKeys.includes(key)) throw new Error("General key rejected.");
  return `/api/admin/settings/${key}`;
};
export const generalWriteFor =
  (pair: GeneralPair, change: GeneralChange) =>
  async (path: string, method: "POST" | "PUT" | "DELETE", body: unknown, signal: AbortSignal) => {
    const row = settingFor(pair, change.scope, change.key);
    const common = {
      scope_type: scope,
      scope_key: z.string(),
      reason: z.string().trim().min(1).max(1000),
      expected_revision: revision,
      confirmed: z.literal(true),
    };
    const request = z
      .discriminatedUnion("operation", [
        z.object({ ...common, operation: z.literal("set"), value }).strict(),
        z.object({ ...common, operation: z.literal("reset") }).strict(),
      ])
      .parse(body);
    if (
      method !== "PUT" ||
      path !== generalSettingPath(change.key) ||
      request.scope_type !== change.scope ||
      request.scope_key !== row.scope_key ||
      request.expected_revision !== pair[change.scope].revision ||
      request.operation !== change.operation ||
      (request.operation === "set"
        ? request.value !== change.value ||
          !validGeneralValue(change.key, request.value) ||
          (row.stored && row.value === request.value)
        : !row.stored || change.value !== null)
    )
      throw conflict();
    await verifyGeneralPair(pair, signal);
    signal.throwIfAborted();
    const response = await checkupinoTransport.request<unknown>({
      method,
      path,
      body: request,
      signal,
    });
    const result = z
      .object({
        success: z.literal(true),
        data: z.object({
          setting: z.object({
            key: z.enum(generalSettingKeys),
            scope_type: scope,
            scope_key: z.string(),
            value: value.nullable(),
            stored: z.boolean(),
          }),
        }),
      })
      .parse(response.data).data.setting;
    if (
      response.status !== 200 ||
      result.key !== change.key ||
      result.scope_type !== change.scope ||
      result.scope_key !== row.scope_key ||
      result.stored !== (change.operation === "set") ||
      result.value !== change.value
    )
      throw new Error("Setting result rejected; refresh before another action.");
    return response;
  };
