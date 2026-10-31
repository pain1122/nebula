import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInstance } from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import type { TransportRequest, TransportResponse } from "../core";
import en from "../locales/en.json";
import fa from "../locales/fa.json";
import ArticleFileManager from "../pages/Administration/content/ArticleFileManager";
import { articleRichHtml, articleImageIds } from "../pages/Administration/content/articleRichHtml";
import {
  imageUrl,
  imagePath,
  mediaResourceSchema,
  uploadImage,
} from "../modules/checkupino/content/media";
import { presentationSchema } from "../modules/checkupino/content/publication";
import { contentWrite, readContent } from "../modules/checkupino/content/api";
import { TransportError, classifyWireFailure } from "../modules/checkupino/api/wire";

const { execute } = vi.hoisted(() => ({
  execute: vi.fn<(request: TransportRequest) => Promise<TransportResponse<unknown>>>(),
}));
vi.mock("../modules/checkupino/api/transport", async (original) => ({
  ...(await original<typeof import("../modules/checkupino/api/transport")>()),
  checkupinoTransport: { request: execute },
}));
vi.mock("../modules/checkupino/auth/authority", () => ({
  adminAuthAuthority: {
    getSnapshot: () => ({ identity: { id: 1, roles: ["admin"] } }),
    subscribe: () => () => {},
  },
}));
vi.mock("../pages/FileManager/FileManagerCharts", () => ({
  default: ({ values }: { values: number[] }) => (
    <div data-file-manager-chart>{values.join(",")}</div>
  ),
}));
const id = "01j00000000000000000000001";
const image = {
  id,
  checksum_sha256: "a".repeat(64),
  mime_type: "image/png",
  size_bytes: 100,
  width: 1,
  height: 1,
};
const resource = (selectable = true) => ({
  asset: image,
  name: "Synthetic image.png",
  status: selectable ? "released" : "quarantined",
  selectable,
  blocker: selectable ? null : "not_released",
  revision: "b".repeat(64),
  content_path: imagePath(id),
});
const wire = (data: unknown) => ({ success: true, data });
const page = (images = [resource()]) =>
  wire({
    purpose: "article_editorial",
    assets: images,
    page: 1,
    per_page: 12,
    total: images.length,
    policy: { revision: "c".repeat(64), limits: { "image/png": 1048576 } },
  });
async function mount(locale: "en" | "fa" = "en") {
  const i18n = Object.assign(createInstance(), {
    reportNamespaces: { addUsedNamespaces: () => {}, getUsedNamespaces: () => [] },
  });
  await i18n.use(initReactI18next).init({
    lng: locale,
    keySeparator: false,
    resources: { en: { translation: en }, fa: { translation: fa } },
    interpolation: { escapeValue: false },
  });
  const select = vi.fn<(image: unknown) => void>(),
    close = vi.fn<() => void>();
  render(
    <I18nextProvider i18n={i18n}>
      <ArticleFileManager onClose={close} onSelect={select} />
    </I18nextProvider>,
  );
  return { select, close };
}
beforeEach(() => {
  execute.mockReset().mockImplementation(async (request) => ({
    status: 200,
    headers: {},
    data: request.path.endsWith(id) ? wire(resource()) : page(),
  }));
});

describe("article image security and portable presentation", () => {
  it("maps only exact authenticated editorial image URLs to portable paths", () => {
    const html = `<figure class="image"><img src="${imageUrl(id)}" alt="آزمایشی" onerror="alert(1)"><figcaption>Caption</figcaption></figure>`;
    const clean = articleRichHtml(html, [id]);
    expect(clean).toContain(imagePath(id));
    expect(clean).not.toContain("onerror");
    expect(clean).not.toContain(imageUrl(id));
    expect(articleImageIds(clean)).toEqual([id]);
    expect(articleRichHtml(clean, [id], true)).toContain(imageUrl(id));
    expect(articleRichHtml(clean, [id])).toEqual(clean);
  });
  it.each([
    "https://evil.test/tracker",
    "data:image/png;base64,AAAA",
    "blob:http://localhost/a",
    "/api/reservations/1/files/2/download",
    imagePath(id) + "?token=secret",
  ])("drops unowned/unsafe image source %s before live insertion", (src) => {
    const clean = articleRichHtml(
      `<img src="${src}"><script>alert(1)</script><svg onload="alert(2)"></svg><p>Safe</p>`,
      [id],
    );
    expect(clean).toBe("<p>Safe</p>");
  });
  it("removes even an editorial URL when it is absent from the exact language manifest", () => {
    expect(articleRichHtml(`<img src="${imagePath(id)}">`, [])).toBe("");
  });
  it("accepts versioned bilingual alt text and rejects forged storage fields or dimensions", () => {
    const presentation = {
      publication: null,
      thumbnail: { asset: image, alt: { en: "Synthetic", fa: "آزمایشی" } },
      inline: [{ asset: image, language: "en" }],
    };
    expect(presentationSchema.parse(presentation)).toEqual(presentation);
    expect(
      presentationSchema.safeParse({
        ...presentation,
        thumbnail: { ...presentation.thumbnail, object_key: "private/patient" },
      }).success,
    ).toBe(false);
    expect(
      mediaResourceSchema.safeParse({ ...resource(), content_path: "/api/private/secret" }).success,
    ).toBe(false);
    expect(
      mediaResourceSchema.safeParse({ ...resource(), asset: { ...image, width: 0 } }).success,
    ).toBe(false);
    expect(
      mediaResourceSchema.safeParse({
        ...resource(false),
        asset: { ...image, width: 0, height: 0 },
      }).success,
    ).toBe(true);
  });
  it("enforces the bounded editorial upload endpoint and sends a real multipart body", async () => {
    const file = new File(["synthetic"], "synthetic.png", { type: "image/png" });
    await uploadImage(
      "/api/admin/article-media",
      "POST",
      { confirmed: true, reason: "Synthetic" },
      file,
    );
    const sent = execute.mock.calls[0][0];
    expect(sent.body).toBeInstanceOf(FormData);
    expect((sent.body as FormData).get("confirmed")).toBe("1");
    await expect(uploadImage("/api/admin/users", "POST", {}, file)).rejects.toThrow(/scope/);
  });
  it("allows editorial reads/actions without exposing raw file URL or destructive generic methods", async () => {
    const signal = new AbortController().signal;
    await readContent("/api/admin/article-media", {}, signal);
    await contentWrite(`/api/admin/article-media/${id}/actions`, "POST", {}, signal);
    await expect(readContent(`/api/admin/article-media/${id}/content`, {}, signal)).rejects.toThrow(
      /scope/,
    );
    await expect(
      contentWrite(`/api/admin/article-media/${id}`, "DELETE", {}, signal),
    ).rejects.toThrow(/scope/);
  });
});
describe("shared editorial File Manager", () => {
  it.each(["en", "fa"] as const)(
    "embeds the Velzon three-pane frame and real list/detail selection in %s",
    async (locale) => {
      const copy = locale === "en" ? en : fa;
      const { select } = await mount(locale);
      await screen.findByRole("button", { name: /Synthetic image.png/ });
      const frame = document.querySelector("[data-velzon-file-manager=embedded]")!;
      expect(frame.children).toHaveLength(3);
      expect(frame.querySelector(".file-manager-sidebar nav")).toHaveAccessibleName(
        copy["content.media.libraryNav"],
      );
      expect(frame.querySelector(".file-manager-detail-content")).toHaveTextContent(
        copy["content.media.overview"],
      );
      expect(frame).not.toHaveTextContent("47.52");
      fireEvent.click(screen.getByRole("button", { name: copy["content.media.list"] }));
      expect(frame.querySelector("[data-file-manager-table]")).not.toBeNull();
      const fileRow = screen.getByRole("button", { name: /Synthetic image.png/ }).closest("tr")!;
      fireEvent.click(fileRow.cells[2]);
      expect(fileRow).toHaveAttribute("aria-selected", "true");
      expect(frame.querySelector(".file-manager-detail-content")).toHaveTextContent(
        copy["content.media.preview"],
      );
      expect(frame.querySelector(".file-manager-detail-content")).toHaveTextContent("1 × 1");
      fireEvent.click(screen.getByRole("button", { name: copy["content.media.choose"] }));
      await waitFor(() => expect(select).toHaveBeenCalledWith(image));
      expect(execute.mock.calls.every(([r]) => r.method === "GET")).toBe(true);
    },
  );
  it("toggles embedded navigation locally without changing the panel body classes", async () => {
    const previous = document.body.className;
    await mount();
    await screen.findByRole("button", { name: /Synthetic image.png/ });
    fireEvent.click(screen.getByRole("button", { name: en["content.media.libraryNav"] }));
    expect(document.querySelector("[data-velzon-file-manager]")).toHaveAttribute(
      "data-sidebar-open",
      "true",
    );
    expect(document.body.className).toBe(previous);
  });
  const installUpload = (failure = false) => {
    let stored = resource(false);
    execute.mockImplementation(async (request) => {
      let data: unknown;
      if (request.path.endsWith("/upload-context"))
        data = wire({
          upload_id: id,
          expires_at: 2000000000,
          revision: "c".repeat(64),
          policy: { revision: "c".repeat(64), limits: { "image/png": 1048576 } },
        });
      else if (request.method === "POST" && request.path.endsWith("/actions")) {
        if (failure) throw new TransportError(classifyWireFailure({ status: 503 }));
        stored = resource();
        data = wire(stored);
      } else if (request.method === "POST") data = wire(stored);
      else data = request.path.endsWith(id) ? wire(stored) : page([stored]);
      return { status: 200, headers: {}, data };
    });
  };
  it.each(["en", "fa"] as const)(
    "uploads and prepares automatically in %s without another dialog or human attestation",
    async (locale) => {
      installUpload();
      const copy = locale === "fa" ? fa : en;
      await mount(locale);
      await screen.findByRole("button", { name: /Synthetic image.png/ });
      fireEvent.change(document.querySelector("input[type=file]")!, {
        target: { files: [new File(["synthetic"], "synthetic.png", { type: "image/png" })] },
      });
      await waitFor(() =>
        expect(screen.getByRole("button", { name: copy["content.media.choose"] })).toBeEnabled(),
      );
      const writes = execute.mock.calls.filter(([r]) => r.method === "POST").map(([r]) => r);
      expect(writes).toHaveLength(2);
      const form = writes[0].body as FormData;
      expect(form.get("upload_id")).toBe(id);
      for (const key of ["reason", "confirmed", "password"]) expect(form.has(key)).toBe(false);
      expect(writes[1].body).toEqual({ action: "validate", expected_revision: "b".repeat(64) });
      expect(screen.getAllByRole("dialog")).toHaveLength(1);
      expect(screen.queryByLabelText(copy["adminManage.reason"])).toBeNull();
      expect(screen.queryByRole("alert")).toBeNull();
    },
  );
  it("keeps failed preparation unavailable and never automatically repeats an uncertain action", async () => {
    installUpload(true);
    await mount();
    await screen.findByRole("button", { name: /Synthetic image.png/ });
    fireEvent.change(document.querySelector("input[type=file]")!, {
      target: { files: [new File(["synthetic"], "synthetic.png", { type: "image/png" })] },
    });
    expect(await screen.findByText(en["content.media.uncertain"])).toHaveProperty(
      "tagName",
      "OUTPUT",
    );
    expect(screen.getByRole("button", { name: en["content.media.choose"] })).toBeDisabled();
    expect(screen.getByRole("button", { name: en["content.media.retry"] })).toBeDisabled();
    expect(execute.mock.calls.filter(([r]) => r.method === "POST")).toHaveLength(2);
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("retires directly once with a freshly read revision", async () => {
    const original = execute.getMockImplementation()!;
    execute.mockImplementation(async (request) =>
      request.method === "POST"
        ? { status: 200, headers: {}, data: wire({ ...resource(false), status: "retired" }) }
        : original(request),
    );
    await mount();
    fireEvent.click(await screen.findByRole("button", { name: /Synthetic image.png/ }));
    const retire = screen.getByRole("button", { name: en["content.media.retire"] });
    fireEvent.click(retire);
    fireEvent.click(retire);
    await waitFor(() =>
      expect(execute.mock.calls.filter(([r]) => r.method === "POST")).toHaveLength(1),
    );
    expect(execute.mock.calls.find(([r]) => r.method === "POST")![0].body).toEqual({
      action: "retire",
      expected_revision: "b".repeat(64),
    });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });
  it.each(["en", "fa"] as const)(
    "selects a freshly verified image through the %s grid",
    async (locale) => {
      const copy = locale === "en" ? en : fa;
      const { select } = await mount(locale);
      fireEvent.click(await screen.findByRole("button", { name: /Synthetic image.png/ }));
      fireEvent.click(screen.getByRole("button", { name: copy["content.media.choose"] }));
      await waitFor(() => expect(select).toHaveBeenCalledWith(image));
      expect(execute.mock.calls.every(([request]) => request.method === "GET")).toBe(true);
    },
  );
  it("does not preview or select quarantined files", async () => {
    execute.mockResolvedValue({ status: 200, headers: {}, data: page([resource(false)]) });
    const { select } = await mount();
    fireEvent.click(await screen.findByRole("button", { name: /Synthetic image.png/ }));
    expect(screen.getByRole("button", { name: en["content.media.choose"] })).toBeDisabled();
    expect(document.querySelector("[data-article-file-manager] img")).toBeNull();
    expect(screen.getByText(en["content.media.validationRequired"])).toBeVisible();
    expect(select).not.toHaveBeenCalled();
  });
  it("refuses a changed selection revision without replay", async () => {
    const { select } = await mount();
    fireEvent.click(await screen.findByRole("button", { name: /Synthetic image.png/ }));
    execute.mockImplementation(async () => ({
      status: 200,
      headers: {},
      data: wire({ ...resource(), revision: "d".repeat(64) }),
    }));
    fireEvent.click(screen.getByRole("button", { name: en["content.media.choose"] }));
    expect(await screen.findByText(en["content.media.changed"])).toBeVisible();
    expect(select).not.toHaveBeenCalled();
  });
  it("shows a real empty state and switches list/grid without fake records", async () => {
    execute.mockResolvedValue({ status: 200, headers: {}, data: page([]) });
    await mount();
    expect(await screen.findByText(en["content.media.empty"])).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: en["content.media.list"] }));
    expect(screen.getByRole("button", { name: en["content.media.grid"] })).toBeVisible();
  });
  it("shows inactive-library refusal and cancel leaves the editor untouched", async () => {
    execute.mockRejectedValue(new Error("Unavailable"));
    const { select, close } = await mount();
    expect(await screen.findByText(en["content.media.unavailable"])).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: en["content.cancel"] }));
    expect(close).toHaveBeenCalledOnce();
    expect(select).not.toHaveBeenCalled();
    expect(execute.mock.calls.every(([request]) => request.method === "GET")).toBe(true);
  });
});
