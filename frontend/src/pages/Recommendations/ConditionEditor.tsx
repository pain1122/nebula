import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { ConditionNode, RuleBoard } from "../../modules/checkupino/recommendations/api";
import { normalizeNumericInput } from "../../modules/checkupino/preferences/localization";

const fields = [
  "age_years",
  "gender",
  "weight_kg",
  "height_cm",
  "bmi",
  "conditions",
  "allergies",
  "smoking",
  "alcohol",
  "low_activity",
  "stress",
  "family_history",
];
export const emptyLeaf = (): ConditionNode => ({
  field: "",
  operator: "eq",
  value: "",
  max_age_days: NaN,
});
export default function ConditionEditor({
  node,
  onChange,
  catalog,
  depth = 1,
}: {
  readonly node: ConditionNode;
  readonly onChange: (value: ConditionNode) => void;
  readonly catalog: RuleBoard["catalog"];
  readonly depth?: number;
}) {
  const { t, i18n } = useTranslation();
  const uid = useId();
  if ("all" in node || "any" in node) {
    const all = "all" in node;
    const children = "all" in node ? node.all : node.any;
    const set = (next: ConditionNode[]) => onChange(all ? { all: next } : { any: next });
    return (
      <fieldset className="border rounded p-3 mb-3">
        <legend className="float-none w-auto fs-6">
          <label htmlFor={uid}>{t("recommendationRules.group")}</label>
        </legend>
        <select
          id={uid}
          className="form-select mb-3"
          value={all ? "all" : "any"}
          onChange={(event) =>
            onChange(event.target.value === "all" ? { all: children } : { any: children })
          }
        >
          <option value="all">{t("recommendationRules.all")}</option>
          <option value="any">{t("recommendationRules.any")}</option>
        </select>
        {children.map((child, index) => (
          <div className="mb-3" key={index}>
            <ConditionEditor
              node={child}
              catalog={catalog}
              depth={depth + 1}
              onChange={(next) => set(children.map((value, at) => (at === index ? next : value)))}
            />
            <button
              type="button"
              className="btn btn-sm btn-soft-danger"
              disabled={children.length === 1}
              onClick={() => set(children.filter((_, at) => at !== index))}
            >
              {t("recommendationRules.remove")}
            </button>
          </div>
        ))}
        <div className="d-flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-sm btn-soft-primary"
            disabled={children.length >= 8}
            onClick={() => set([...children, emptyLeaf()])}
          >
            {t("recommendationRules.addCondition")}
          </button>
          {depth < 3 && (
            <button
              type="button"
              className="btn btn-sm btn-light"
              disabled={children.length >= 8}
              onClick={() => set([...children, { all: [emptyLeaf()] }])}
            >
              {t("recommendationRules.addGroup")}
            </button>
          )}
        </div>
      </fieldset>
    );
  }
  const numeric = ["age_years", "weight_kg", "height_cm", "bmi"].includes(node.field);
  const coded = ["conditions", "allergies"].includes(node.field);
  const operators = numeric
    ? ["eq", "lt", "lte", "gt", "gte", "between"]
    : coded
      ? ["contains", "reported_none"]
      : ["eq"];
  const changeField = (field: string) => {
    const next = {
      field,
      operator: ["conditions", "allergies"].includes(field) ? "contains" : "eq",
      value: "",
      max_age_days: NaN,
    } as Extract<ConditionNode, { field: string }>;
    const unit = ({ weight_kg: "kg", height_cm: "cm", bmi: "kg/m2" } as Record<string, string>)[
      field
    ];
    if (unit) next.unit = unit;
    if (field === "bmi") next.max_measurement_gap_days = NaN;
    onChange(next);
  };
  const value = (index: number) => (Array.isArray(node.value) ? node.value[index] : node.value);
  const setValue = (raw: string, index: number) => {
    const normalized = normalizeNumericInput(raw);
    const next =
      node.field === "age_years" && normalized !== ""
        ? Number(normalized)
        : numeric
          ? normalized
          : raw;
    if (node.operator === "between") {
      const values = Array.isArray(node.value) ? [...node.value] : ["", ""];
      values[index] = next;
      onChange({ ...node, value: values });
    } else onChange({ ...node, value: next });
  };
  return (
    <div className="row g-2">
      <div className="col-md-4">
        <label className="form-label" htmlFor={uid}>
          {t("recommendationRules.field")}
        </label>
        <select
          id={uid}
          className="form-select"
          value={node.field}
          required
          onChange={(event) => changeField(event.target.value)}
        >
          <option value="">{t("recommendationRules.choose")}</option>
          {fields.map((field) => (
            <option key={field} value={field}>
              {t(`recommendationRules.fields.${field}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="col-md-3">
        <label className="form-label" htmlFor={`${uid}-operator`}>
          {t("recommendationRules.comparison")}
        </label>
        <select
          id={`${uid}-operator`}
          className="form-select"
          value={node.operator}
          onChange={(event) => {
            const operator = event.target.value;
            const next = { ...node, operator };
            if (operator === "reported_none") delete next.value;
            else next.value = operator === "between" ? ["", ""] : "";
            onChange(next);
          }}
        >
          {operators.map((operator) => (
            <option key={operator} value={operator}>
              {t(`recommendationRules.operators.${operator}`)}
            </option>
          ))}
        </select>
      </div>
      {node.operator !== "reported_none" && (
        <div className="col-md-5">
          <label className="form-label" htmlFor={`${uid}-value`}>
            {t("recommendationRules.value")}
            {node.unit ? ` (${node.unit})` : ""}
          </label>
          {numeric ? (
            <div className="d-flex gap-2">
              {(node.operator === "between" ? [0, 1] : [0]).map((index) => (
                <input
                  key={index}
                  id={`${uid}-value${index ? "-upper" : ""}`}
                  aria-label={t(index ? "recommendationRules.upper" : "recommendationRules.value")}
                  className="form-control"
                  inputMode="decimal"
                  required
                  value={value(index) ?? ""}
                  onChange={(event) => setValue(event.target.value, index)}
                />
              ))}
            </div>
          ) : (
            <select
              id={`${uid}-value`}
              className="form-select"
              required
              value={String(node.value ?? "")}
              onChange={(event) => setValue(event.target.value, 0)}
            >
              <option value="">{t("recommendationRules.choose")}</option>
              {coded
                ? catalog.terms
                    .filter(
                      (term) =>
                        term.active &&
                        term.kind === (node.field === "conditions" ? "condition" : "allergy"),
                    )
                    .map((term) => (
                      <option key={term.id} value={term.id}>
                        {i18n.resolvedLanguage === "fa" ? term.labels.fa : term.labels.en}
                      </option>
                    ))
                : (node.field === "gender" ? ["male", "female"] : ["yes", "no"]).map((item) => (
                    <option key={item} value={item}>
                      {t(`recommendationRules.answers.${item}`)}
                    </option>
                  ))}
            </select>
          )}
        </div>
      )}
      <div className="col-md-6">
        <label className="form-label" htmlFor={`${uid}-age`}>
          {t("recommendationRules.freshness")}
        </label>
        <input
          id={`${uid}-age`}
          className="form-control"
          type="number"
          min={0}
          max={3650}
          required
          disabled={node.max_age_days === null}
          value={
            node.max_age_days !== null && Number.isFinite(node.max_age_days)
              ? node.max_age_days
              : ""
          }
          onChange={(event) =>
            onChange({
              ...node,
              max_age_days: event.target.value === "" ? NaN : Number(event.target.value),
            })
          }
        />
        {["age_years", "gender"].includes(node.field) && (
          <label className="form-check mt-2">
            <input
              type="checkbox"
              className="form-check-input"
              checked={node.max_age_days === null}
              onChange={(event) =>
                onChange({ ...node, max_age_days: event.target.checked ? null : NaN })
              }
            />
            <span className="form-check-label">{t("recommendationRules.noExpiry")}</span>
          </label>
        )}
      </div>
      {node.field === "bmi" && (
        <div className="col-md-6">
          <label className="form-label" htmlFor={`${uid}-gap`}>
            {t("recommendationRules.measurementGap")}
          </label>
          <input
            id={`${uid}-gap`}
            className="form-control"
            type="number"
            min={0}
            max={3650}
            required
            value={
              Number.isFinite(node.max_measurement_gap_days) ? node.max_measurement_gap_days : ""
            }
            onChange={(event) =>
              onChange({
                ...node,
                max_measurement_gap_days:
                  event.target.value === "" ? NaN : Number(event.target.value),
              })
            }
          />
        </div>
      )}
    </div>
  );
}
