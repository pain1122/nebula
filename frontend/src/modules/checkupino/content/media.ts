import { z } from "../forms";
import {
  checkupinoTransport,
  articleMediaImagePath,
  articleMediaImageUrl,
  articleMediaImageId,
} from "../api/transport";

const id = z.string().regex(/^[0-7][0-9a-hjkmnp-tv-z]{25}$/);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const imageSnapshotSchema = z
  .object({
    id,
    checksum_sha256: hash,
    mime_type: z.enum(["image/jpeg", "image/png"]),
    size_bytes: z.number().int().min(1).max(33554432),
    width: z.number().int().min(1).max(8192),
    height: z.number().int().min(1).max(8192),
  })
  .strict()
  .refine((v) => v.width * v.height <= 16000000);
export type ArticleImage = z.infer<typeof imageSnapshotSchema>;
const pendingImage = z.object({
  id,
  checksum_sha256: hash,
  mime_type: z.enum(["image/jpeg", "image/png"]),
  size_bytes: z.number().int().min(1).max(33554432),
  width: z.number().int().min(0).max(8192),
  height: z.number().int().min(0).max(8192),
});
export const mediaResourceSchema = z
  .object({
    asset: pendingImage,
    name: z.string().max(180),
    status: z.enum(["quarantined", "released", "retired"]),
    selectable: z.boolean(),
    blocker: z.string().max(100).nullable(),
    revision: hash,
    content_path: z.string(),
  })
  .refine(
    (v) =>
      v.content_path === imagePath(v.asset.id) &&
      (!v.selectable ||
        (v.status === "released" &&
          v.blocker === null &&
          imageSnapshotSchema.safeParse(v.asset).success)),
  );
export type ArticleMedia = z.infer<typeof mediaResourceSchema>;
const policy = z.object({
  revision: hash,
  limits: z.record(z.string(), z.number().int().min(1).max(33554432)),
});
export const mediaPageSchema = z.object({
  purpose: z.literal("article_editorial"),
  assets: z.array(mediaResourceSchema).max(12),
  page: z.number().int().min(1).max(10000),
  per_page: z.literal(12),
  total: z.number().int().min(0),
  policy,
});
export const uploadContextSchema = z.object({
  upload_id: id,
  expires_at: z.number().int(),
  revision: hash,
  policy,
});
export const imagePath = articleMediaImagePath;
export const imageUrl = articleMediaImageUrl;
export const imageIdFromUrl = articleMediaImageId;
export const mediaData = (wire: unknown) =>
  z.object({ success: z.literal(true), data: z.unknown() }).parse(wire).data;
export const uploadImage = async (
  path: string,
  method: "POST" | "PUT" | "DELETE",
  body: unknown,
  file: File,
  signal?: AbortSignal,
) => {
  if (path !== "/api/admin/article-media" || method !== "POST")
    throw new Error("Editorial upload scope rejected.");
  const form = new FormData();
  form.set("file", file);
  for (const [key, value] of Object.entries(z.record(z.string(), z.unknown()).parse(body)))
    form.set(key, value === true ? "1" : String(value));
  return checkupinoTransport.request({ path, method, body: form, signal });
};
