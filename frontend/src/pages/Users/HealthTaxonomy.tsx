import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import type { HealthProfile, HealthSelection } from "../../modules/checkupino/profiles/health";
import { normalizeProductLocale } from "../../modules/checkupino/preferences/localization";

/** Selected stable IDs remain visible while searching; labels never become submitted values. */
export default function HealthTaxonomy({
  kind,
  catalog,
  value,
  onChange,
}: {
  readonly kind: "conditions" | "allergies";
  readonly catalog: HealthProfile["catalog"];
  readonly value: HealthSelection | null | undefined;
  readonly onChange: (value: HealthSelection | null) => void;
}) {
  const { t, i18n } = useTranslation(),
    id = useId();
  const locale = normalizeProductLocale(i18n.resolvedLanguage);
  const [search, setSearch] = useState("");
  const terms = catalog.terms.filter(
    (term) => term.kind === (kind === "conditions" ? "condition" : "allergy"),
  );
  return (
    <fieldset className="border rounded p-3 mb-3">
      <legend className="float-none w-auto fs-6 px-1">{t(`health.${kind}`)}</legend>
      <label className="form-label" htmlFor={id}>
        {t("health.reportedStatus")}
      </label>
      <select
        id={id}
        className="form-select mb-2"
        value={value?.status ?? ""}
        onChange={(event) => {
          const status = event.target.value as HealthSelection["status"] | "";
          onChange(status ? { status, codes: [] } : null);
        }}
      >
        <option value="">{t("health.unanswered")}</option>
        <option value="yes">{t("health.hasReported")}</option>
        <option value="no">{t("health.noneReported")}</option>
        <option value="unknown">{t("health.unknown")}</option>
        <option value="declined">{t("health.declined")}</option>
      </select>
      {value?.status === "yes" && (
        <>
          <label className="form-label" htmlFor={`${id}-search`}>
            {t("health.searchTerms")}
          </label>
          <input
            id={`${id}-search`}
            type="search"
            className="form-control mb-2"
            value={search}
            maxLength={100}
            onChange={(e) => setSearch(e.target.value)}
          />
          <p className="text-muted small">{t("health.catalogHint")}</p>
          <div className="row g-2">
            {terms
              .filter(
                (term) =>
                  value.codes.includes(term.id) ||
                  Object.values(term.labels).some((label) =>
                    label.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
                  ),
              )
              .map((term) => (
                <div className="col-sm-6" key={term.id}>
                  <label className="form-check">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={value.codes.includes(term.id)}
                      disabled={!term.active && !value.codes.includes(term.id)}
                      onChange={(e) =>
                        onChange({
                          status: "yes",
                          codes: (e.target.checked
                            ? [...value.codes, term.id]
                            : value.codes.filter((code) => code !== term.id)
                          ).sort(),
                        })
                      }
                    />
                    <span className="form-check-label">{term.labels[locale]}</span>
                  </label>
                </div>
              ))}
          </div>
        </>
      )}
    </fieldset>
  );
}
