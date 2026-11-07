import { z } from "../forms";
import { patientArticleImageUrl } from "../api/transport";
import { checkupinoApi, type createCheckupinoApi } from "../query/api";

const id = z.string().regex(/^[0-7][0-9a-hjkmnp-tv-z]{25}$/);
const term = z.object({ id, label: z.string().max(200) }).strict();
const image = z
  .object({
    content_path: z.string(),
    alt: z.string().max(255),
    width: z.number().int().positive().max(8192),
    height: z.number().int().positive().max(8192),
  })
  .strict();
const card = z
  .object({
    id,
    version_id: id,
    title: z.string().max(200),
    summary: z.string().max(1000),
    content_language: z.enum(["en", "fa"]),
    fallback_used: z.boolean(),
    categories: z.array(term).max(30),
    tags: z.array(term).max(30),
    thumbnail: image.nullable(),
  })
  .strict();
const detail = card.extend({
  author: z.object({ display_name: z.string().max(255) }).strict(),
  body_html: z.string().max(100000),
  source_links: z
    .array(
      z
        .object({ url: z.string().url().startsWith("https://"), label: z.string().max(200) })
        .strict(),
    )
    .max(20),
});
const pagination = z.object({
  current_page: z.number().int().min(1).max(10000),
  last_page: z.number().int().min(1),
  per_page: z.number().int().min(1).max(24),
  total: z.number().int().min(0),
});
export type PatientArticle = z.infer<typeof card>;
export type PatientArticleDetail = z.infer<typeof detail>;
export type PatientArticleImage = z.infer<typeof image>;
export type ArticleQuery = {
  language: "en" | "fa";
  page?: number;
  per_page?: number;
  q?: string;
  category_id?: string;
  tag_id?: string;
};
export const libraryQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    per_page: z.coerce.number().int().min(1).max(24).default(12),
    q: z
      .string()
      .max(120)
      .refine((value) =>
        Array.from(value).every((char) => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127),
      )
      .default(""),
    category_id: id.optional(),
    tag_id: id.optional(),
  })
  .strict();

export function patientImageUrl(
  path: string,
  articleId: string,
  versionId: string,
  language: string,
): string {
  id.parse(articleId);
  id.parse(versionId);
  const match =
    /^\/api\/my\/articles\/([0-7][0-9a-hjkmnp-tv-z]{25})\/media\/([0-7][0-9a-hjkmnp-tv-z]{25})\?/.exec(
      path,
    );
  const url = new URL(path, "https://patient.invalid");
  if (
    !match ||
    match[1] !== articleId ||
    url.searchParams.get("version_id") !== versionId ||
    url.searchParams.get("language") !== language ||
    [...url.searchParams.keys()].length !== 2 ||
    !["en", "fa"].includes(language)
  )
    throw new Error("Patient image binding rejected.");
  return patientArticleImageUrl(path);
}

function checkedCard<T extends PatientArticle>(value: T): T {
  if (value.thumbnail)
    patientImageUrl(
      value.thumbnail.content_path,
      value.id,
      value.version_id,
      value.content_language,
    );
  return value;
}

export const parsePatientArticlePage = (wire: unknown) => {
  const parsed = z
    .object({
      success: z.literal(true),
      data: z.array(card).max(24),
      meta: z.object({ pagination }),
    })
    .parse(wire);
  return { items: parsed.data.map(checkedCard), pagination: parsed.meta.pagination };
};
export const parsePatientArticle = (wire: unknown) =>
  checkedCard(z.object({ success: z.literal(true), data: detail }).parse(wire).data);
export const parsePatientArticleCard = (wire: unknown) => checkedCard(card.parse(wire));
const parseTerms = (wire: unknown) => {
  const result = z
    .object({
      success: z.literal(true),
      data: z.array(term).max(24),
      meta: z.object({ pagination }),
    })
    .parse(wire);
  return { items: result.data, pagination: result.meta.pagination };
};

export const createPatientArticleApi = (api: ReturnType<typeof createCheckupinoApi>) =>
  api.injectEndpoints({
    endpoints: (builder) => ({
      patientArticles: builder.query<ReturnType<typeof parsePatientArticlePage>, ArticleQuery>({
        keepUnusedDataFor: 0,
        query: (query) => ({
          method: "GET",
          path: "/api/my/articles",
          query: Object.fromEntries(
            Object.entries(query).filter(([, value]) => value !== undefined && value !== ""),
          ),
        }),
        transformResponse: parsePatientArticlePage,
      }),
      patientArticle: builder.query<PatientArticleDetail, { id: string; language: "en" | "fa" }>({
        keepUnusedDataFor: 0,
        query: ({ id: articleId, language }) => ({
          method: "GET",
          path: `/api/my/articles/${id.parse(articleId)}`,
          query: { language },
        }),
        transformResponse: parsePatientArticle,
      }),
      patientArticleTerms: builder.query<
        ReturnType<typeof parseTerms>,
        { kind: "category" | "tag"; language: "en" | "fa"; q: string; page: number }
      >({
        keepUnusedDataFor: 0,
        query: ({ q, ...query }) => ({
          method: "GET",
          path: "/api/my/article-taxonomies",
          query: { ...query, per_page: 24, ...(q ? { q } : {}) },
        }),
        transformResponse: parseTerms,
      }),
    }),
  });
export const { usePatientArticlesQuery, usePatientArticleQuery, usePatientArticleTermsQuery } =
  createPatientArticleApi(checkupinoApi);

// Patient-only inert rendering. Staff image URLs and arbitrary remote images never reach the DOM.
export function patientArticleHtml(html: string, article: PatientArticle): string {
  const source = document.createElement("template"),
    output = document.createElement("template");
  source.innerHTML = html;
  const allowed = new Set([
    "p",
    "br",
    "strong",
    "em",
    "b",
    "i",
    "u",
    "ul",
    "ol",
    "li",
    "blockquote",
    "h2",
    "h3",
    "h4",
    "a",
    "figure",
    "figcaption",
    "img",
  ]);
  const blocked = new Set([
    "script",
    "style",
    "iframe",
    "object",
    "embed",
    "svg",
    "math",
    "template",
    "form",
    "input",
    "textarea",
    "select",
    "button",
    "video",
    "audio",
    "canvas",
    "link",
    "meta",
    "base",
    "noscript",
  ]);
  const copy = (node: Node, parent: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      parent.appendChild(document.createTextNode(node.textContent ?? ""));
      return;
    }
    if (!(node instanceof Element) || blocked.has(node.localName)) return;
    const tag = node.localName;
    if (!allowed.has(tag)) {
      node.childNodes.forEach((child) => copy(child, parent));
      return;
    }
    const clean = document.createElement(tag);
    if (tag === "img") {
      try {
        clean.setAttribute(
          "src",
          patientImageUrl(
            node.getAttribute("src") ?? "",
            article.id,
            article.version_id,
            article.content_language,
          ),
        );
      } catch {
        return;
      }
      clean.setAttribute(
        "alt",
        Array.from(node.getAttribute("alt") ?? "")
          .filter((char) => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127)
          .slice(0, 255)
          .join(""),
      );
      clean.setAttribute("class", "img-fluid");
      clean.setAttribute("loading", "lazy");
    }
    if (tag === "figure")
      clean.setAttribute(
        "class",
        node.classList.contains("image-style-side") ? "image image-style-side" : "image",
      );
    if (tag === "a") {
      try {
        const href = node.getAttribute("href") ?? "";
        if (["http:", "https:", "mailto:", "tel:"].includes(new URL(href).protocol)) {
          clean.setAttribute("href", href);
          clean.setAttribute("rel", "noopener noreferrer");
        }
      } catch {
        /* Invalid links remain text. */
      }
    }
    node.childNodes.forEach((child) => copy(child, clean));
    parent.appendChild(clean);
  };
  source.content.childNodes.forEach((node) => copy(node, output.content));
  return output.innerHTML;
}
