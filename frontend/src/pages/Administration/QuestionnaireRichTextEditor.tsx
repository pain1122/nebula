import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { QuestionnaireClassicEditor } from "../../Components/Common/ToolboxClassicEditor";
import { QUESTIONNAIRE_RICH_TEXT_LIMIT, questionnaireRichHtml } from "./questionnaireRichHtml";

interface RichTextProps {
  readonly contentLocale?: "en" | "fa";
  readonly id: string;
  readonly label: string;
  readonly value: string | null;
  readonly disabled: boolean;
  readonly onChange: (html: string | null) => void;
  readonly onValidityChange: (valid: boolean | null) => void;
}
export default function QuestionnaireRichTextEditor(props: RichTextProps) {
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage === "fa" ? "fa" : "en";
  return (
    <EditorSession
      key={locale + ":" + (props.contentLocale ?? "auto")}
      {...props}
      locale={locale}
    />
  );
}
function EditorSession({
  id,
  label,
  value,
  disabled,
  onChange,
  onValidityChange,
  locale,
  contentLocale,
}: RichTextProps & { readonly locale: "en" | "fa" }) {
  const { t } = useTranslation();
  const data = useMemo(() => {
    try {
      return { html: questionnaireRichHtml(value), valid: true };
    } catch {
      return { html: "", valid: false };
    }
  }, [value]);
  // CKEditor owns the active draft/caret. Fresh reads, version changes and locale changes
  // remount this session; echoing sanitized HTML after each key would reset native list editing.
  const [initialData] = useState(() => data.html);
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false),
    [tooLong, setTooLong] = useState(false);
  const validity = useRef(onValidityChange);
  useEffect(() => {
    onValidityChange(ready && !failed && !tooLong && data.valid);
  }, [ready, failed, tooLong, data.valid, onValidityChange]);
  useEffect(() => () => validity.current(null), []);
  const problem = failed || !data.valid;
  return (
    <div className="mb-3" data-questionnaire-rich-text={id}>
      <p id={id + "-label"} className="form-label">
        {label}
      </p>
      {problem ? (
        <p role="alert" className="alert alert-warning">
          {t("adminManage.editorUnavailable")}
        </p>
      ) : (
        <QuestionnaireClassicEditor
          key={locale}
          locale={locale}
          contentLocale={contentLocale}
          data={initialData}
          disabled={disabled}
          onReady={(editor) => {
            // View-owned attributes survive native typing, undo and editor renders.
            // Direct DOM attributes are removed when CKEditor synchronizes its view.
            editor.editing.view.change((writer) => {
              const root = editor.editing.view.document.getRoot();
              if (root) {
                writer.setAttribute("id", id, root);
                writer.setAttribute("aria-labelledby", id + "-label", root);
              }
            });
            setTooLong(editor.getData().length > QUESTIONNAIRE_RICH_TEXT_LIMIT);
            setReady(true);
          }}
          onError={() => {
            setFailed(true);
            setReady(false);
          }}
          onChange={(_event, editor) => {
            if (disabled || failed) return;
            const html = editor.getData();
            if (html.length > QUESTIONNAIRE_RICH_TEXT_LIMIT) {
              setTooLong(true);
              return;
            }
            setTooLong(false);
            try {
              const clean = questionnaireRichHtml(html);
              onChange(clean || null);
            } catch {
              setTooLong(true);
            }
          }}
        />
      )}
      {tooLong ? (
        <p role="alert" className="text-danger">
          {t("adminManage.editorTooLong")}
        </p>
      ) : null}
    </div>
  );
}
