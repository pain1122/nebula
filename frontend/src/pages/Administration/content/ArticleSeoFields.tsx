import { useTranslation } from "react-i18next";
import {
  emptySeo,
  seoCharacters,
  seoCounterTone,
  seoRanges,
  validCanonical,
  validSchemaJson,
  type ArticleSeo,
} from "../../../modules/checkupino/content/seo";

export default function ArticleSeoFields({
  value,
  language,
  onChange,
}: {
  readonly value?: ArticleSeo;
  readonly language: "en" | "fa";
  readonly onChange: (value: ArticleSeo) => void;
}) {
  const { t } = useTranslation();
  const fields = value ?? emptySeo();
  const update = (key: keyof ArticleSeo, text: string) => onChange({ ...fields, [key]: text });
  return (
    <div data-article-seo-language={language}>
      <p className="text-muted small">
        {t("content.seo.language", { language: t(`content.language.${language}`) })}
      </p>
      {(["title", "description", "keywords", "schema_json", "canonical_url"] as const).map(
        (key) => {
          const id = `article-seo-${key}-${language}`;
          const counted = key === "title" || key === "description";
          const invalid =
            key === "schema_json"
              ? !validSchemaJson(fields[key])
              : key === "canonical_url" && !validCanonical(fields[key]);
          const props = {
            id,
            className: "form-control" + (invalid ? " is-invalid" : ""),
            value: fields[key],
            lang: key === "schema_json" || key === "canonical_url" ? "en" : language,
            dir:
              key === "schema_json" || key === "canonical_url" || language === "en"
                ? ("ltr" as const)
                : ("rtl" as const),
            placeholder: t(`content.seo.example.${key}`, { lng: language }),
            "aria-invalid": !!invalid,
            "aria-describedby": id + "-help",
            onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
              update(key, event.target.value),
          };
          return (
            <div className="mb-3" key={key}>
              <label className="form-label" htmlFor={id}>
                {t(`content.seo.${key}`)}
              </label>
              {key === "description" || key === "schema_json" ? (
                <textarea
                  {...props}
                  rows={key === "schema_json" ? 7 : 3}
                  spellCheck={key !== "schema_json"}
                />
              ) : (
                <input {...props} type={key === "canonical_url" ? "url" : "text"} />
              )}
              <div id={id + "-help"}>
                {counted ? (
                  <small
                    className={seoCounterTone(fields[key], key)}
                    data-seo-counter={key}
                    aria-live="polite"
                  >
                    {t("content.seo.count", {
                      count: seoCharacters(fields[key]),
                      min: seoRanges[key][0],
                      max: seoRanges[key][1],
                    })}
                  </small>
                ) : null}
                {key === "keywords" || key === "schema_json" || key === "canonical_url" ? (
                  <small className="d-block text-muted">{t(`content.seo.hint.${key}`)}</small>
                ) : null}
                {invalid ? (
                  <small className="d-block text-danger">{t(`content.seo.invalid.${key}`)}</small>
                ) : null}
              </div>
            </div>
          );
        },
      )}
    </div>
  );
}
