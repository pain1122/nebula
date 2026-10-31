import type { TransportAdapter } from "../../../core";
import { checkupinoTransport } from "../api/transport";
import { z } from "../forms";
import { normalizeNumericInput } from "../preferences/localization";

export const uploadSettingKeys = ["uploads.medical", "uploads.public_media"] as const;
export type UploadSettingKey = (typeof uploadSettingKeys)[number];
export type SizeUnit = "bytes" | "MiB";
export interface SizeInput {
  readonly amount: string;
  readonly unit: SizeUnit;
}

const bytes = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const byteMap = z.preprocess(
  (value) => (Array.isArray(value) && value.length === 0 ? {} : value),
  z.record(z.string(), bytes),
);
const settingSchema = z.object({
  key: z.enum(uploadSettingKeys),
  scope_type: z.literal("platform"),
  scope_key: z.literal("marketplace"),
  revision: z.string().regex(/^[a-f0-9]{64}$/),
  policy_state: z.enum(["active", "review_required"]),
  policy: z.object({
    allowed_mime_types: z.array(z.string().min(1)).min(1),
    max_bytes_by_mime: byteMap,
  }),
  type_limit_overrides: byteMap,
  default_max_bytes: bytes,
  configured_default_max_bytes: bytes,
  capacity_max_bytes: bytes,
  scanner_max_bytes: bytes.nullable(),
});
export type UploadSetting = z.infer<typeof settingSchema>;

export const adaptUploadSetting = (
  response: unknown,
  expectedKey: UploadSettingKey,
): UploadSetting => {
  const setting = z.object({ data: z.object({ setting: settingSchema }) }).parse(response)
    .data.setting;
  const types = setting.policy.allowed_mime_types;
  const ceiling = uploadCapacity(setting);
  if (
    setting.key !== expectedKey ||
    new Set(types).size !== types.length ||
    (expectedKey === "uploads.medical") !== (setting.scanner_max_bytes !== null) ||
    Object.keys(setting.policy.max_bytes_by_mime).length !== types.length ||
    types.some((mime) => !(mime in setting.policy.max_bytes_by_mime)) ||
    Object.keys(setting.type_limit_overrides).some((mime) => !types.includes(mime)) ||
    Object.values(setting.policy.max_bytes_by_mime).some((limit) => limit > ceiling)
  )
    throw new Error("Invalid upload policy response.");
  return setting;
};

export const uploadCapacity = (setting: UploadSetting) =>
  Math.min(setting.capacity_max_bytes, setting.scanner_max_bytes ?? setting.capacity_max_bytes);

export class SizeInputError extends Error {
  constructor(readonly code: "invalidSize" | "wholeBytes" | "aboveCapacity") {
    super(code);
  }
}

// Integer arithmetic preserves byte boundaries, including decimal MiB and Persian digits.
export const parseSizeInput = ({ amount, unit }: SizeInput, ceiling: number): number => {
  const normalized = normalizeNumericInput(amount.trim()).replace(/\u066b/g, ".");
  if (normalized.length > 40 || !/^\d+(?:\.\d{1,20})?$/.test(normalized))
    throw new SizeInputError("invalidSize");
  const [whole, fraction = ""] = normalized.split(".");
  const denominator = 10n ** BigInt(fraction.length);
  const numerator = BigInt(`${whole}${fraction}`) * (unit === "MiB" ? 1048576n : 1n);
  if (numerator % denominator !== 0n) throw new SizeInputError("wholeBytes");
  const value = numerator / denominator;
  if (value < 1n) throw new SizeInputError("invalidSize");
  if (value > BigInt(Math.min(ceiling, Number.MAX_SAFE_INTEGER)))
    throw new SizeInputError("aboveCapacity");
  return Number(value);
};

export const sizeInputFor = (value: number): SizeInput =>
  value % 1048576 === 0
    ? { amount: String(value / 1048576), unit: "MiB" }
    : { amount: String(value), unit: "bytes" };

export interface UploadPolicyDraft {
  readonly defaultSize: SizeInput;
  readonly types: Readonly<Record<string, SizeInput>>;
  readonly reason: string;
}
export const uploadPolicyDraft = (setting: UploadSetting): UploadPolicyDraft => ({
  defaultSize: sizeInputFor(setting.default_max_bytes),
  types: Object.fromEntries(
    setting.policy.allowed_mime_types.map((mime) => [
      mime,
      setting.type_limit_overrides[mime] === undefined
        ? { amount: "", unit: "MiB" }
        : sizeInputFor(setting.type_limit_overrides[mime]),
    ]),
  ),
  reason: "",
});

export const uploadPolicyValue = (setting: UploadSetting, draft: UploadPolicyDraft) => ({
  max_bytes: parseSizeInput(draft.defaultSize, uploadCapacity(setting)),
  type_limits: Object.fromEntries(
    setting.policy.allowed_mime_types.flatMap((mime) => {
      const input = draft.types[mime];
      return !input || !input.amount.trim()
        ? []
        : [[mime, parseSizeInput(input, uploadCapacity(setting))]];
    }),
  ),
});

export const createUploadPolicyGateway = (transport: TransportAdapter) => ({
  async save(
    setting: UploadSetting,
    value: ReturnType<typeof uploadPolicyValue> | readonly [],
    reason: string,
    signal?: AbortSignal,
  ) {
    await transport.request({
      method: "PUT",
      path: `/api/admin/settings/${setting.key}`,
      body: {
        scope_type: setting.scope_type,
        scope_key: setting.scope_key,
        value,
        reason: reason.trim(),
        expected_revision: setting.revision,
      },
      signal,
    });
  },
});
export const uploadPolicyGateway = createUploadPolicyGateway(checkupinoTransport);
