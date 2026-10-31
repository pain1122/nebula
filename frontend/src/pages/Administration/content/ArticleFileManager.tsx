import EditorialFileManager from "../../FileManager/EditorialFileManager";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog } from "../../../modules/checkupino/overlays";
import { readContent, contentWrite, conflict } from "../../../modules/checkupino/content/api";
import {
  imageSnapshotSchema,
  mediaData,
  mediaPageSchema,
  mediaResourceSchema,
  uploadContextSchema,
  uploadImage,
  type ArticleImage,
  type ArticleMedia,
} from "../../../modules/checkupino/content/media";
import { ContentState, useContent } from "./Shared";
import {
  useDirectAction,
  type DirectActionContext,
} from "../../../modules/checkupino/content/useDirectAction";
import { adminAuthAuthority } from "../../../modules/checkupino/auth/authority";

export default function ArticleFileManager({
  onClose,
  onSelect,
}: {
  readonly onClose: () => void;
  readonly onSelect: (asset: ArticleImage) => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage === "fa" ? "fa" : "en";
  const [q, setQ] = useState(""),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1);
  const [view, setView] = useState<"released" | "all">("released");
  const [selected, setSelected] = useState<ArticleMedia | null>(null);
  const direct = useDirectAction();
  const { busy, uncertain, failure } = direct;
  const [phase, setPhase] = useState<"loading" | "uploading" | "preparing" | "updating">("loading");
  useEffect(() => {
    const actor = adminAuthAuthority.getSnapshot().identity;
    const id = actor?.id,
      roles = actor?.roles.join("|");
    return adminAuthAuthority.subscribe(() => {
      const current = adminAuthAuthority.getSnapshot().identity;
      if (id !== current?.id || roles !== current?.roles.join("|")) onClose();
    });
  }, [onClose]);
  const result = useContent(
    "/api/admin/article-media",
    { q: search || undefined, page, view },
    (wire) => mediaPageSchema.parse(mediaData(wire)),
  );
  const close = () => {
    if (!busy) onClose();
  };
  const fresh = async (row: ArticleMedia, signal: AbortSignal) => {
    const current = mediaResourceSchema.parse(
      mediaData(await readContent("/api/admin/article-media/" + row.asset.id, {}, signal)),
    );
    if (
      current.asset.id !== row.asset.id ||
      current.revision !== row.revision ||
      current.status === "retired"
    )
      throw conflict();
    return current;
  };
  const act = async (
    row: ArticleMedia,
    action: "validate" | "retire",
    { signal, dispatch }: DirectActionContext,
  ) => {
    const current = await fresh(row, signal);
    const response = await dispatch(() =>
      contentWrite(
        "/api/admin/article-media/" + row.asset.id + "/actions",
        "POST",
        { action, expected_revision: current.revision },
        signal,
      ),
    );
    const updated = mediaResourceSchema.parse(mediaData(response.data));
    if (updated.asset.id !== row.asset.id) throw new Error("Image action identity changed.");
    return updated;
  };
  const choose = () =>
    direct.run(async ({ signal }) => {
      if (!selected?.selectable) return;
      setPhase("loading");
      const current = await fresh(selected, signal);
      if (!current.selectable) throw conflict();
      if (!signal.aborted) onSelect(imageSnapshotSchema.parse(current.asset));
    });
  const upload = (file: File) =>
    direct.run(async (context) => {
      setPhase("uploading");
      const issued = uploadContextSchema.parse(
        mediaData(await readContent("/api/admin/article-media/upload-context", {}, context.signal)),
      );
      if (
        !issued.policy.limits[file.type] ||
        file.size < 1 ||
        file.size > issued.policy.limits[file.type]
      )
        throw new Error("File outside current image policy.");
      const response = await context.dispatch(() =>
        uploadImage(
          "/api/admin/article-media",
          "POST",
          {
            upload_id: issued.upload_id,
            expires_at: issued.expires_at,
            expected_revision: issued.revision,
          },
          file,
          context.signal,
        ),
      );
      const admitted = mediaResourceSchema.parse(mediaData(response.data));
      if (admitted.asset.id !== issued.upload_id)
        throw new Error("Image admission identity changed.");
      if (context.signal.aborted) return;
      setSelected(admitted);
      setPage(1);
      setView("all");
      setPhase("preparing");
      const prepared = await act(admitted, "validate", context);
      if (!context.signal.aborted) {
        setSelected(prepared);
        result.refresh();
      }
    });
  const action = (row: ArticleMedia, kind: "validate" | "retire") =>
    direct.run(async (context) => {
      setPhase(kind === "validate" ? "preparing" : "updating");
      const updated = await act(row, kind, context);
      if (!context.signal.aborted) {
        setSelected(updated);
        result.refresh();
      }
    });
  return (
    <Dialog
      open
      size="lg"
      title={t("content.media.library")}
      locale={locale}
      onClose={close}
      busy={busy}
    >
      <div data-article-file-manager>
        <EditorialFileManager
          assets={result.data?.assets ?? []}
          selected={selected}
          total={result.data?.total ?? 0}
          page={page}
          query={q}
          view={view}
          busy={busy}
          locked={busy || uncertain}
          uploadEnabled={!busy && !uncertain && !!result.data}
          onQuery={setQ}
          onSearch={() => {
            setSearch(q.trim());
            setPage(1);
            setSelected(null);
          }}
          onView={(value) => {
            setView(value);
            setPage(1);
            setSelected(null);
          }}
          onPage={(value) => {
            setPage(value);
            setSelected(null);
          }}
          onRefresh={() => {
            result.refresh();
            setSelected(null);
            direct.reset();
          }}
          onUpload={(file) => void upload(file)}
          onSelect={setSelected}
          onChoose={() => void choose()}
          onAction={(row, kind) => void action(row, kind)}
          onClose={close}
          notice={
            <>
              <ContentState busy={result.busy} error={false} />
              {busy ? (
                <output className="text-muted small d-block mb-2">
                  {t(`content.media.${phase}`)}
                </output>
              ) : null}
              {result.error ? (
                <output className="text-muted small d-block mb-2" data-media-status="unavailable">
                  {t("content.media.unavailable")}
                </output>
              ) : null}
              {failure ? (
                <output className="text-muted small d-block mb-2">
                  {t(
                    uncertain
                      ? "content.media.uncertain"
                      : failure === "conflict"
                        ? "content.media.changed"
                        : "content.media.failed",
                  )}
                </output>
              ) : null}
            </>
          }
        />
      </div>
    </Dialog>
  );
}
