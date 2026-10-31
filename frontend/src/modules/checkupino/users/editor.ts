import type { TransportAdapter } from "../../../core";
import { checkupinoTransport } from "../api/transport";
import type { ApiEnvelope } from "../api/types";
import { z } from "../forms";
import type { AdminDirectoryUser } from "./directory";

export interface AdminUser extends AdminDirectoryUser {
  readonly birth_date: string | null;
  readonly NID: string | null;
  readonly city: string | null;
  readonly country: string | null;
  readonly zip_code: string | null;
  readonly bio: string | null;
}

export const userEditorFields = [
  "first_name",
  "last_name",
  "phone",
  "email",
  "birth_date",
  "NID",
  "role",
  "patient_status",
  "city",
  "country",
  "zip_code",
  "bio",
  "password",
  "password_confirmation",
  "reason",
] as const;

export interface UserEditorValues {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  birth_date: string;
  NID: string;
  role: string;
  patient_status: string;
  city: string;
  country: string;
  zip_code: string;
  bio: string;
  password: string;
  password_confirmation: string;
  reason: string;
}

export const userEditorDefaults = (user?: AdminUser): UserEditorValues => ({
  first_name: user?.first_name ?? "",
  last_name: user?.last_name ?? "",
  phone: user?.phone ?? "",
  email: user?.email ?? "",
  birth_date: user?.birth_date ?? "",
  NID: user?.NID ?? "",
  role: user ? (user.role ?? "") : "patient",
  patient_status: user?.patient_status ?? "free",
  city: user?.city ?? "",
  country: user?.country ?? "",
  zip_code: user?.zip_code ?? "",
  bio: user?.bio ?? "",
  password: "",
  password_confirmation: "",
  reason: "",
});

export const createUserEditorSchema = (
  copy: (key: string) => string,
  creating: boolean,
  manageAdminIdentities: boolean,
  originalRole?: AdminUser["role"],
  staffOnly = false,
) => {
  const required = (maximum: number) =>
    z
      .string()
      .trim()
      .min(1, copy("users.validation.required"))
      .max(maximum, copy("users.validation.tooLong"));
  const optional = (maximum: number) =>
    z.string().trim().max(maximum, copy("users.validation.tooLong"));
  return z
    .object({
      first_name: required(100),
      last_name: required(100),
      phone: required(30),
      email: required(255).email(copy("users.validation.email")),
      birth_date: z.iso.date(copy("users.validation.date")),
      NID: required(10).length(10, copy("users.validation.nid")),
      role: z
        .string()
        .refine(
          (role) =>
            staffOnly
              ? manageAdminIdentities && role === "admin"
              : role === "patient" ||
                role === "doctor" ||
                (manageAdminIdentities && role === "admin"),
          copy("users.validation.role"),
        ),
      patient_status: z
        .string()
        .refine(
          (state) => ["free", "trial", "active", "expired", "suspended"].includes(state),
          copy("users.validation.required"),
        ),
      city: optional(120),
      country: optional(120),
      zip_code: optional(20),
      bio: optional(2000),
      password: creating
        ? z
            .string()
            .min(15, copy("users.validation.passwordLength"))
            .max(64, copy("users.validation.passwordLength"))
        : z.literal(""),
      password_confirmation: z.string(),
      reason: optional(1000),
    })
    .superRefine((values, context) => {
      if (creating && values.password !== values.password_confirmation)
        context.addIssue({
          code: "custom",
          path: ["password_confirmation"],
          message: copy("users.validation.passwordMatch"),
        });
      if ((originalRole === "admin" || values.role === "admin") && !values.reason)
        context.addIssue({
          code: "custom",
          path: ["reason"],
          message: copy("users.validation.reason"),
        });
    });
};

export const userEditorPayload = (values: UserEditorValues, creating: boolean) => ({
  first_name: values.first_name,
  last_name: values.last_name,
  phone: values.phone,
  email: values.email,
  birth_date: values.birth_date,
  NID: values.NID,
  role: values.role,
  patient_status: values.role === "patient" ? values.patient_status : null,
  city: values.city || null,
  country: values.country || null,
  zip_code: values.zip_code || null,
  bio: values.bio || null,
  reason: values.reason || null,
  ...(creating
    ? { password: values.password, password_confirmation: values.password_confirmation }
    : {}),
});

export const createUserWriteGateway = (transport: TransportAdapter) => ({
  async save(
    values: UserEditorValues,
    userId: number | null,
    signal?: AbortSignal,
  ): Promise<AdminUser> {
    const response = await transport.request<ApiEnvelope<{ readonly user: AdminUser }>>({
      body: userEditorPayload(values, userId === null),
      method: userId === null ? "POST" : "PUT",
      path: userId === null ? "/api/admin/users" : `/api/admin/users/${userId}`,
      signal,
    });
    return response.data.data.user;
  },
});

export const userWriteGateway = createUserWriteGateway(checkupinoTransport);

const suggestionWords = [
  "amber",
  "apple",
  "birch",
  "bloom",
  "brook",
  "cedar",
  "cloud",
  "coral",
  "dawn",
  "dune",
  "elm",
  "fern",
  "field",
  "finch",
  "flame",
  "frost",
  "grove",
  "hill",
  "iris",
  "jade",
  "lake",
  "leaf",
  "maple",
  "mint",
  "moon",
  "ocean",
  "olive",
  "pine",
  "rain",
  "river",
  "stone",
  "willow",
] as const;

export const suggestUserPassword = () => {
  const random = crypto.getRandomValues(new Uint32Array(6));
  const words = Array.from(
    random.slice(0, 4),
    (value) => suggestionWords[value % suggestionWords.length],
  );
  const suffix = Array.from(random.slice(4), (value) => value.toString(16).padStart(8, "0")).join(
    "",
  );
  return [...words, suffix].join("-");
};
