import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  ClassicEditor,
  ClipboardPipeline,
} from "../../../Components/Common/ToolboxClassicEditor";
import { ArticleClassicEditor } from "../../../Components/Common/ToolboxClassicEditor";
import { articleRichHtml } from "./articleRichHtml";
import { imageUrl, type ArticleImage } from "../../../modules/checkupino/content/media";
export type ArticleImageInserter = (image: ArticleImage) => void;

export default function ArticleRichTextEditor({
  id,
  label,
  value,
  disabled,
  contentLocale,
  images,
  onChange,
  onValidityChange,
  onBrowse,
}: {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly disabled: boolean;
  readonly contentLocale: "en" | "fa";
  readonly images: readonly string[];
  readonly onChange: (value: string) => void;
  readonly onValidityChange: (value: boolean | null) => void;
  readonly onBrowse: (insert: ArticleImageInserter) => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage === "fa" ? "fa" : "en";
  const [initialData] = useState(() => articleRichHtml(value, images, true));
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false),
    [invalid, setInvalid] = useState(false);
  const current = useRef({ images, disabled });
  current.current = { images, disabled };
  const validity = useRef(onValidityChange);
  useEffect(() => {
    onValidityChange(ready && !failed && !invalid);
  }, [ready, failed, invalid, onValidityChange]);
  useEffect(() => () => validity.current(null), []);
  return (
    <div className="mb-3" data-article-rich-text={id}>
      <p className="form-label" id={id + "-label"}>
        {label}
      </p>
      {failed ? (
        <p role="alert" className="alert alert-warning">
          {t("adminManage.editorUnavailable")}
        </p>
      ) : (
        <ArticleClassicEditor
          locale={locale}
          contentLocale={contentLocale}
          data={initialData}
          disabled={disabled}
          onBrowse={(editor: ClassicEditor) => {
            if (current.current.disabled) return;
            const range = editor.model.document.selection.getFirstRange()?.clone();
            onBrowse((image) => {
              if (editor.state !== "ready" || current.current.disabled) return;
              current.current = {
                ...current.current,
                images: [...new Set([...current.current.images, image.id])],
              };
              editor.model.change((writer) => {
                if (range) writer.setSelection(range);
              });
              editor.execute("insertImage", { source: imageUrl(image.id) });
              editor.editing.view.focus();
            });
          }}
          onReady={(editor) => {
            editor.editing.view.change((writer) => {
              const root = editor.editing.view.document.getRoot();
              if (root) {
                writer.setAttribute("id", id, root);
                writer.setAttribute("aria-labelledby", id + "-label", root);
              }
            });
            const clipboard = editor.plugins.get("ClipboardPipeline") as ClipboardPipeline;
            clipboard.on(
              "inputTransformation",
              (_event, data) => {
                const html = editor.data.processor.toData(data.content);
                data.content = editor.data.processor.toView(
                  articleRichHtml(html, current.current.images, true),
                );
              },
              { priority: "high" },
            );
            setReady(true);
          }}
          onError={() => {
            setFailed(true);
            setReady(false);
          }}
          onChange={(_event, editor) => {
            if (current.current.disabled || failed) return;
            try {
              const html = articleRichHtml(editor.getData(), current.current.images);
              onChange(html);
              setInvalid(false);
            } catch {
              setInvalid(true);
            }
          }}
        />
      )}
      {invalid ? (
        <p role="alert" className="text-danger">
          {t("adminManage.editorTooLong")}
        </p>
      ) : null}
    </div>
  );
}
