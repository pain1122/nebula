import { z } from "../forms";
import { checkupinoTransport } from "../api/transport";

const revision = z.string().regex(/^[a-f0-9]{64}$/);
const publicId = z.string().regex(/^[0-9a-hjkmnp-tv-z]{26}$/i);
const hospital = z.object({
  public_id: publicId,
  name: z.string(),
  slug: z.string(),
  timezone: z.string(),
  country_code: z.string().nullable(),
  province: z.string().nullable(),
  city: z.string().nullable(),
  address: z.string().nullable(),
  contact_phone: z.string().nullable(),
  contact_email: z.string().nullable(),
  website_url: z.string().nullable(),
  profile: z.string().nullable(),
  is_active: z.boolean(),
  archived: z.boolean(),
});
export type Hospital = z.infer<typeof hospital>;
export type HospitalInput = Omit<Hospital, "public_id" | "archived">;
export const hospitalList = z.object({
  hospitals: z.array(hospital).max(20),
  page: z.number().int(),
  last_page: z.number().int(),
  total: z.number().int(),
});
export const hospitalDetail = z.object({ hospital, revision });
export const createContext = z.object({ revision });
export const accountContext = z.object({
  revision,
  specialties: z.array(z.object({ id: z.number().int().positive(), name: z.string() })).max(500),
  verification_on_create: z.boolean(),
});
export const locationOptions = z.object({
  owner_id: z.number().int().positive(),
  revision,
  default_price: z.number().int().nonnegative(),
  hospitals: z
    .array(
      z.object({
        public_id: publicId,
        name: z.string(),
        city: z.string().nullable(),
        address: z.string().nullable(),
        timezone: z.string(),
        revision,
      }),
    )
    .max(20),
  page: z.number().int(),
  last_page: z.number().int(),
  services: z
    .array(
      z.object({
        id: z.number().int().positive(),
        title: z.string(),
        currency: z.string().regex(/^[A-Z]{3}$/),
      }),
    )
    .max(500),
});
export const accountReceipt = z.object({
  user: z.object({
    id: z.number().int().positive(),
    public_id: publicId,
    role: z.enum(["patient", "doctor"]),
    email: z.null(),
    phone: z.null(),
    NID: z.null(),
    birth_date: z.null(),
  }),
});
export async function clinicalRequest<T>(
  method: "GET" | "POST" | "PUT",
  path: string,
  schema: z.ZodType<T>,
  signal: AbortSignal,
  body?: unknown,
): Promise<T> {
  signal.throwIfAborted();
  const separator = path.indexOf("?");
  const pathname = separator < 0 ? path : path.slice(0, separator);
  const query =
    separator < 0 ? undefined : Object.fromEntries(new URLSearchParams(path.slice(separator + 1)));
  const result = await checkupinoTransport.request({ method, path: pathname, query, signal, body });
  signal.throwIfAborted();
  if (result.status !== 200) throw new Error("Clinical request rejected");
  return schema.parse((result.data as { data: unknown }).data);
}
export const hospitalReceipt = z.object({ hospital });
