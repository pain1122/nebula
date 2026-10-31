import { z } from "../forms";
import { checkupinoTransport } from "../api/transport";
import { TransportError } from "../api/wire";
import { validScheduleDate, validWorkplaceId } from "./api";

const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const publicId = z.string().regex(/^[0-9a-hjkmnp-tv-z]{26}$/i);
const date = z.string().refine(validScheduleDate);
const price = z.string().regex(/^(0|[1-9]\d{0,19})$/);
const selectionSchema = z.object({
  workplace_id: id,
  checkup_id: id,
  scope: z.enum(["slot", "day", "week"]),
  date,
  slot_public_id: publicId.nullable(),
});
export type SlotSelection = z.infer<typeof selectionSchema>;
const previewSchema = z.object({
  selection: selectionSchema,
  period: z.object({
    from: date,
    to: date,
    timezone: z.string().refine((value) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }),
  }),
  items: z
    .array(
      z.object({
        public_id: publicId,
        starts_at: z.iso.datetime({ offset: true }),
        ends_at: z.iso.datetime({ offset: true }),
        price,
        currency: z.string().regex(/^[A-Z]{3}$/),
        is_active: z.boolean(),
        eligible: z.boolean(),
        exclusions: z
          .array(
            z.enum([
              "offering_unavailable",
              "rule_unavailable",
              "past",
              "reservation_history",
              "blocking_reservation",
            ]),
          )
          .max(5),
      }),
    )
    .max(250),
  eligible_count: z.number().int().min(0).max(250),
  limits: z.object({
    slots: z.literal(250),
    max_price: z.literal("9007199254740991"),
    reason: z.literal(1000),
  }),
  revision: z.string().regex(/^[a-f0-9]{64}$/),
  preview_expires_at: id,
});
export type SlotPreview = z.infer<typeof previewSchema>;
export const slotControlPath = (workplaceId: string) => {
  if (!validWorkplaceId(workplaceId)) throw new Error("Invalid workplace identity.");
  return `/api/admin/schedules/workplaces/${workplaceId}/slot-control`;
};
export const adaptSlotPreview = (response: unknown, expected: SlotSelection): SlotPreview => {
  const result = z.object({ success: z.literal(true), data: previewSchema }).parse(response).data;
  const selected = selectionSchema.parse(expected);
  const anchor = new Date(selected.date + "T00:00:00Z");
  if (selected.scope === "week")
    anchor.setUTCDate(anchor.getUTCDate() - ((anchor.getUTCDay() + 6) % 7));
  const from = anchor.toISOString().slice(0, 10);
  if (selected.scope === "week") anchor.setUTCDate(anchor.getUTCDate() + 6);
  const to = anchor.toISOString().slice(0, 10);
  const formatter = new Intl.DateTimeFormat("en", {
    timeZone: result.period.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const localDate = (timestamp: string) => {
    const parts = formatter.formatToParts(new Date(timestamp));
    return ["year", "month", "day"]
      .map((key) => parts.find((part) => part.type === key)?.value)
      .join("-");
  };
  if (
    Object.keys(selected).some(
      (key) =>
        result.selection[key as keyof SlotSelection] !== selected[key as keyof SlotSelection],
    ) ||
    (selected.scope === "slot") !== (selected.slot_public_id !== null) ||
    result.eligible_count !== result.items.filter((item) => item.eligible).length ||
    new Set(result.items.map((item) => item.public_id.toLowerCase())).size !==
      result.items.length ||
    result.items.some(
      (item) =>
        item.eligible !== (item.exclusions.length === 0) ||
        new Date(item.ends_at) <= new Date(item.starts_at),
    ) ||
    (selected.scope === "slot" &&
      (result.items.length !== 1 || result.items[0]?.public_id !== selected.slot_public_id)) ||
    result.period.from !== from ||
    result.period.to !== to ||
    result.items.some(
      (item) => localDate(item.starts_at) < from || localDate(item.starts_at) > to,
    ) ||
    result.period.to < result.period.from ||
    Date.parse(result.period.to) - Date.parse(result.period.from) > 6 * 86400000
  )
    throw new Error("Schedule preview identity or targets rejected.");
  return result;
};
export const readSlotPreview = async (
  selection: SlotSelection,
  signal: AbortSignal,
  expires?: number,
) => {
  const { workplace_id, slot_public_id, ...rest } = selectionSchema.parse(selection);
  const response = await checkupinoTransport.request<unknown>({
    method: "GET",
    path: slotControlPath(String(workplace_id)),
    signal,
    query: {
      ...rest,
      ...(slot_public_id ? { slot_public_id } : {}),
      ...(expires ? { preview_expires_at: expires } : {}),
    },
  });
  return adaptSlotPreview(response.data, selection);
};
export const verifySlotPreview = async (preview: SlotPreview, signal: AbortSignal) => {
  const fresh = await readSlotPreview(preview.selection, signal, preview.preview_expires_at);
  if (fresh.revision !== preview.revision || fresh.eligible_count === 0)
    throw new TransportError({
      kind: "http",
      status: 409,
      code: "stale_revision",
      message: null,
      errors: {},
      meta: null,
      correlationId: null,
      retryAfter: null,
    });
};
export const slotControlWrite = async (
  path: string,
  method: "POST" | "PUT" | "DELETE",
  body: unknown,
  signal: AbortSignal,
) => {
  if (
    method !== "PUT" ||
    !/^\/api\/admin\/schedules\/workplaces\/[1-9]\d*\/slot-control$/.test(path)
  )
    throw new Error("Schedule write scope rejected.");
  const response = await checkupinoTransport.request<unknown>({ method, path, body, signal });
  const result = z
    .object({
      success: z.literal(true),
      data: z.object({
        workplace_id: id,
        changed_slot_public_ids: z.array(publicId).min(1).max(250),
      }),
    })
    .parse(response.data);
  if (
    slotControlPath(String(result.data.workplace_id)) !== path ||
    new Set(result.data.changed_slot_public_ids).size !== result.data.changed_slot_public_ids.length
  )
    throw new Error("Schedule write result rejected.");
  return response;
};
