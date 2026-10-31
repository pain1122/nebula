import { z } from "../forms";
import { checkupinoApi } from "../query/api";
import { checkupinoTransport } from "../api/transport";

const id = z.number().int().positive().safe();
const rule = z.object({
  checkup_id: id,
  start: z.string(),
  end: z.string(),
  duration_minutes: z.number().int(),
  price_override: z.number().nullable(),
  currency_override: z.string().nullable(),
  effective_from: z.string().nullable(),
  effective_until: z.string().nullable(),
  breaks: z.array(z.object({ start: z.string(), end: z.string() })).max(8),
});
const schema = z.object({
  owner_id: id,
  revision: z.string().regex(/^[a-f0-9]{64}$/),
  verified: z.boolean(),
  professional: z.object({
    specialty_ids: z.array(id),
    primary_specialty_id: id.nullable(),
    experience_years: z.number().int(),
    fee: z.number().int(),
    bio: z.string(),
  }),
  specialty_options: z.array(z.object({ id, name: z.string() })).max(500),
  workplaces: z.array(
    z.object({
      id,
      name: z.string().nullable(),
      hospital_public_id: z.string().nullable().optional(),
      city: z.string().nullable().optional(),
      address: z.string().nullable().optional(),
      timezone: z.string().nullable(),
      active: z.boolean(),
      services: z.array(
        z.object({
          id,
          title: z.string(),
          active: z.boolean(),
          price: z.number().int().nonnegative().optional(),
          currency: z.string().optional(),
        }),
      ),
      availability: z.array(
        z.object({
          day: z.enum(["sun", "mon", "tue", "wed", "thu", "fri", "sat"]),
          windows: z.array(rule),
        }),
      ),
    }),
  ),
});
export type DoctorPractice = z.infer<typeof schema>;
export const practiceReceipt = schema;
export type WorkingRule = z.infer<typeof rule>;
export type PracticeWrite =
  | {
      mode: "professional";
      specialty_ids: number[];
      primary_specialty_id: number;
      experience_years: number;
      fee: number;
      bio: string;
    }
  | {
      mode: "weekly";
      workplace_id: number;
      availability: DoctorPractice["workplaces"][number]["availability"];
    };
const parse = (wire: unknown) => schema.parse((wire as { data: unknown }).data);
export const readPractice = async (signal: AbortSignal) => {
  signal.throwIfAborted();
  const response = await checkupinoTransport.request({
    method: "GET",
    path: "/api/doctor/practice",
    signal,
  });
  signal.throwIfAborted();
  if (response.status !== 200) throw new Error("Practice read rejected");
  return parse(response.data);
};
export const savePractice = async (
  data: PracticeWrite & { expected_revision: string; reason: string; confirmed: true },
  signal: AbortSignal,
) => {
  signal.throwIfAborted();
  const response = await checkupinoTransport.request({
    method: "PUT",
    path: "/api/doctor/practice",
    body: data,
    signal,
  });
  signal.throwIfAborted();
  if (response.status !== 200) throw new Error("Practice save rejected");
  return parse(response.data);
};
const api = checkupinoApi.injectEndpoints({
  endpoints: (builder) => ({
    doctorPractice: builder.query<DoctorPractice, void>({
      keepUnusedDataFor: 0,
      query: () => ({ method: "GET", path: "/api/doctor/practice" }),
      transformResponse: parse,
    }),
  }),
});
export const { useDoctorPracticeQuery } = api;
const pendingKey = (owner: number) => `checkupino.practice.pending.v1.${owner}`;
export const practicePending = (owner: number) => {
  try {
    return sessionStorage.getItem(pendingKey(owner)) === "1";
  } catch {
    return true;
  }
};
export const markPracticePending = (owner: number, pending: boolean) => {
  try {
    if (pending) sessionStorage.setItem(pendingKey(owner), "1");
    else sessionStorage.removeItem(pendingKey(owner));
  } catch {
    /* Refuse automatic replay; a fresh read is still required. */
  }
};
