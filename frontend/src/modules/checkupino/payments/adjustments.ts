import { z } from "../forms";
import { checkupinoTransport } from "../api/transport";
import { TransportError } from "../api/wire";
import { validPaymentId, type PaymentRecord } from "./api";

const money = z
  .string()
  .regex(/^(0|[1-9]\d{0,19})$/)
  .refine((value) => /^(0|[1-9]\d{0,19})$/.test(value) && BigInt(value) <= 18446744073709551615n);
const timestamp = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const revision = z.string().regex(/^[a-f0-9]{64}$/);
const publicId = z.string().refine(validPaymentId);
const contextSchema = z.object({
  payment_public_id: publicId,
  revision,
  expires_at: timestamp,
  can_request: z.boolean(),
  blocked: z
    .enum([
      "payment_not_paid",
      "canonical_inconsistent",
      "amount_unavailable",
      "adjustment_history_inconsistent",
      "nothing_remaining",
    ])
    .nullable(),
  amount: money,
  currency: z.string().regex(/^[A-Z]{3}$/),
  remaining_amount: money,
  request_only: z.literal(true),
  limits: z.object({ max_amount: z.literal("9223372036854775807"), reason: z.literal(1000) }),
});
export type AdjustmentContext = z.infer<typeof contextSchema>;
export const adjustmentPath = (paymentId: string) => {
  if (!validPaymentId(paymentId)) throw new Error("Payment identity rejected.");
  return `/api/admin/payments/${paymentId}/adjustments`;
};
export const adaptAdjustmentContext = (
  wire: unknown,
  expected: Pick<PaymentRecord, "public_id" | "amount" | "currency">,
): AdjustmentContext => {
  const result = z.object({ success: z.literal(true), data: contextSchema }).parse(wire).data;
  if (
    !validPaymentId(expected.public_id) ||
    result.payment_public_id.toLowerCase() !== expected.public_id.toLowerCase() ||
    result.amount !== expected.amount ||
    result.currency !== expected.currency ||
    result.can_request !== (result.blocked === null) ||
    BigInt(result.remaining_amount) > BigInt(result.amount) ||
    (result.can_request &&
      (BigInt(result.remaining_amount) === 0n ||
        BigInt(result.amount) > BigInt(result.limits.max_amount)))
  )
    throw new Error("Payment preview binding rejected.");
  return result;
};
export const readAdjustmentContext = async (
  expected: Pick<PaymentRecord, "public_id" | "amount" | "currency">,
  signal: AbortSignal,
  expires?: number,
) => {
  adjustmentPath(expected.public_id);
  const response = await checkupinoTransport.request<unknown>({
    method: "GET",
    path: `/api/admin/payments/${expected.public_id}/adjustment-context`,
    signal,
    ...(expires === undefined ? {} : { query: { expires_at: expires } }),
  });
  return adaptAdjustmentContext(response.data, expected);
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
export const verifyAdjustmentContext = async (context: AdjustmentContext, signal: AbortSignal) => {
  if (!context.can_request || context.expires_at * 1000 <= Date.now()) throw conflict();
  const fresh = await readAdjustmentContext(
    { public_id: context.payment_public_id, amount: context.amount, currency: context.currency },
    signal,
    context.expires_at,
  );
  if (
    !fresh.can_request ||
    fresh.revision !== context.revision ||
    fresh.expires_at !== context.expires_at ||
    fresh.remaining_amount !== context.remaining_amount
  )
    throw conflict();
};
export const validAdjustmentAmount = (
  value: string,
  context: AdjustmentContext | null,
  type: "refund" | "void",
) =>
  !!context?.can_request &&
  /^[1-9]\d{0,18}$/.test(value) &&
  BigInt(value) <= BigInt(context.remaining_amount) &&
  BigInt(value) <= BigInt(context.limits.max_amount) &&
  (type !== "void" || value === context.remaining_amount);

// The shared dialog owns password retries. Each retry repeats verify with the original revision.
export const adjustmentWriteFor =
  (context: AdjustmentContext) =>
  async (path: string, method: "POST" | "PUT" | "DELETE", body: unknown, signal: AbortSignal) => {
    const request = z
      .object({
        type: z.enum(["refund", "void"]),
        amount: money,
        reason: z.string().trim().min(1).max(1000),
        expected_revision: revision,
        expires_at: timestamp,
        confirmed: z.literal(true),
      })
      .strict()
      .parse(body);
    if (
      method !== "POST" ||
      path !== adjustmentPath(context.payment_public_id) ||
      request.expected_revision !== context.revision ||
      request.expires_at !== context.expires_at ||
      request.expires_at * 1000 <= Date.now() ||
      !validAdjustmentAmount(request.amount, context, request.type)
    )
      throw conflict();
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
          public_id: publicId,
          payment_public_id: publicId,
          type: z.enum(["refund", "void"]),
          amount_exact: money,
          currency: z.string(),
          status: z.literal("pending"),
          request_only: z.literal(true),
          created_at: z.iso.datetime({ offset: true }),
        }),
      })
      .parse(response.data).data;
    if (
      response.status !== 201 ||
      result.payment_public_id.toLowerCase() !== context.payment_public_id.toLowerCase() ||
      result.type !== request.type ||
      result.amount_exact !== request.amount ||
      result.currency !== context.currency
    )
      throw new Error("Payment request result rejected; refresh before another request.");
    return response;
  };
