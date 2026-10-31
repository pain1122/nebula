import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Card, CardBody, Col, Container, Row } from "reactstrap";
import BreadCrumb from "../../Components/Common/BreadCrumb";
import { useShellAuth } from "../../Layouts/ShellAuthContext";
import {
  adaptQuestionnaire,
  questionnairePayload,
  useAdminQuestionnaireQuery,
  validNumericId,
  type AdminQuestionnaire,
} from "../../modules/checkupino/administration/api";
import { checkupinoTransport } from "../../modules/checkupino/api/transport";
import {
  formatProductNumber,
  normalizeProductLocale,
} from "../../modules/checkupino/preferences/localization";
import ActionDialog, { type ActionTarget } from "./ActionDialog";
import DetailBox from "./DetailBox";
import QuestionnaireRichTextEditor from "./QuestionnaireRichTextEditor";

type EditorValues = ReturnType<typeof questionnairePayload>;
const blank = (): EditorValues => ({
  title: "",
  slug: "",
  status: "draft",
  content_html: null,
  cover_image_url: null,
  questions: [
    {
      text: "",
      sort_order: 0,
      choices: [
        { text: "", score: 0, sort_order: 0 },
        { text: "", score: 1, sort_order: 1 },
      ],
    },
  ],
  recommendations: [],
});

function Editor({
  row,
  onSaved,
}: {
  readonly row?: AdminQuestionnaire;
  readonly onSaved: () => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = normalizeProductLocale(i18n.resolvedLanguage);
  const [values, setValues] = useState<EditorValues>(() =>
    row ? questionnairePayload(row) : blank(),
  );
  const [target, setTarget] = useState<ActionTarget | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [invalidRichFields, setInvalidRichFields] = useState<Record<string, boolean>>({});
  const [recommendationKeys, setRecommendationKeys] = useState(() =>
    values.recommendations.map(() => crypto.randomUUID()),
  );
  const richValidity = (field: string) => (valid: boolean | null) =>
    setInvalidRichFields((previous) => {
      const key = `${locale}:${field}`;
      if (valid !== null && previous[key] === !valid) return previous;
      if (valid === null && !(key in previous)) return previous;
      const next = { ...previous };
      if (valid === null) delete next[key];
      else next[key] = !valid;
      return next;
    });
  const richValid =
    invalidRichFields[`${locale}:introduction`] === false &&
    values.recommendations.every(
      (_row, index) =>
        invalidRichFields[`${locale}:recommendation-${recommendationKeys[index]}`] === false,
    );
  const text = (key: "title" | "slug" | "cover_image_url") => (
    <label className="form-label d-block" key={key}>
      {t(`adminManage.${key}`)}
      <input
        dir={key === "title" ? "auto" : "ltr"}
        className="form-control mb-3"
        required={key === "title" || key === "slug"}
        maxLength={key === "cover_image_url" ? 1024 : 255}
        value={values[key] ?? ""}
        onChange={(event) => setValues({ ...values, [key]: event.target.value })}
      />
    </label>
  );
  const verify = async (signal: AbortSignal) => {
    if (!row) return;
    const response = await checkupinoTransport.request({
      path: `/api/admin/questionnaires/${row.id}`,
      method: "GET",
      signal,
    });
    const fresh = adaptQuestionnaire(response.data, row.id);
    if (fresh.version !== row.version) throw new Error("Questionnaire version changed.");
  };
  const confirm = (archive = false) =>
    (archive || richValid) &&
    setTarget({
      title: t(archive ? "adminManage.archive" : "adminManage.save"),
      path: `/api/admin/questionnaires${row ? `/${row.id}` : ""}`,
      method: archive ? "DELETE" : row ? "PUT" : "POST",
      body: { ...(!archive ? values : {}), ...(row ? { expected_version: row.version } : {}) },
      verify,
    });
  return (
    <>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          confirm();
        }}
      >
        <fieldset disabled={!!target || uncertain}>
          <Row>
            <DetailBox
              id="questionnaire-definition"
              title={t("adminManage.definition")}
              icon="ri-survey-line"
            >
              {row ? (
                <p>
                  {t("adminManage.version")}: {formatProductNumber(row.version, locale)} ·{" "}
                  <Link to={`/questionnaire-submissions?questionnaire_id=${row.id}`}>
                    {t("adminManage.questionnaire-submissions")}
                  </Link>
                </p>
              ) : null}
              {text("title")}
              {text("slug")}
              <label className="form-label d-block">
                {t("adminManage.status")}
                <select
                  className="form-select mb-3"
                  value={values.status}
                  onChange={(event) =>
                    setValues({
                      ...values,
                      status: event.target.value === "published" ? "published" : "draft",
                    })
                  }
                >
                  {["draft", "published"].map((state) => (
                    <option key={state} value={state}>
                      {t(`adminManage.state.${state}`)}
                    </option>
                  ))}
                </select>
              </label>
            </DetailBox>
            <DetailBox
              id="questionnaire-introduction"
              title={t("adminManage.content_html")}
              icon="ri-file-text-line"
            >
              <QuestionnaireRichTextEditor
                id="questionnaire-introduction-editor"
                label={t("adminManage.content_html")}
                value={values.content_html}
                disabled={!!target || uncertain}
                onValidityChange={richValidity("introduction")}
                onChange={(html) => setValues((previous) => ({ ...previous, content_html: html }))}
              />
              {text("cover_image_url")}
              <p className="text-muted">{t("adminManage.htmlNotice")}</p>
            </DetailBox>
          </Row>
          <Row>
            {values.questions.map((q, index) => (
              <DetailBox
                key={index}
                id={`questionnaire-question-${index}`}
                title={
                  <>
                    {t("adminManage.question")} {formatProductNumber(index + 1, locale)}
                  </>
                }
                icon="ri-question-answer-line"
                actions={
                  <button
                    type="button"
                    className="btn btn-sm btn-light"
                    disabled={values.questions.length === 1}
                    onClick={() =>
                      setValues({
                        ...values,
                        questions: values.questions
                          .filter((_q, i) => i !== index)
                          .map((question, i) => ({ ...question, sort_order: i })),
                      })
                    }
                  >
                    {t("adminManage.remove")}
                  </button>
                }
              >
                <label className="form-label d-block">
                  {t("adminManage.questionText")}
                  <textarea
                    dir="auto"
                    required
                    maxLength={2000}
                    className="form-control mb-3"
                    value={q.text}
                    onChange={(event) =>
                      setValues({
                        ...values,
                        questions: values.questions.map((question, i) =>
                          i === index ? { ...question, text: event.target.value } : question,
                        ),
                      })
                    }
                  />
                </label>
                {q.choices.map((choice, choiceIndex) => (
                  <div className="row g-2 mb-2" key={choiceIndex}>
                    <label className="col-12 form-label">
                      {t("adminManage.choice")} {formatProductNumber(choiceIndex + 1, locale)}
                      <input
                        dir="auto"
                        required
                        maxLength={2000}
                        className="form-control"
                        value={choice.text}
                        onChange={(event) =>
                          setValues({
                            ...values,
                            questions: values.questions.map((question, i) =>
                              i === index
                                ? {
                                    ...question,
                                    choices: question.choices.map((c, j) =>
                                      j === choiceIndex ? { ...c, text: event.target.value } : c,
                                    ),
                                  }
                                : question,
                            ),
                          })
                        }
                      />
                    </label>
                    <label className="col-sm-6 form-label">
                      {t("adminManage.score")}
                      <input
                        className="form-control"
                        required
                        type="number"
                        min={-1000000}
                        max={1000000}
                        step={1}
                        value={choice.score}
                        onChange={(event) =>
                          setValues({
                            ...values,
                            questions: values.questions.map((question, i) =>
                              i === index
                                ? {
                                    ...question,
                                    choices: question.choices.map((c, j) =>
                                      j === choiceIndex
                                        ? { ...c, score: Number(event.target.value) }
                                        : c,
                                    ),
                                  }
                                : question,
                            ),
                          })
                        }
                      />
                    </label>
                    <div className="col-sm-6">
                      <button
                        type="button"
                        className="btn btn-light"
                        disabled={q.choices.length === 1}
                        onClick={() =>
                          setValues({
                            ...values,
                            questions: values.questions.map((question, i) =>
                              i === index
                                ? {
                                    ...question,
                                    choices: question.choices
                                      .filter((_c, j) => j !== choiceIndex)
                                      .map((c, j) => ({ ...c, sort_order: j })),
                                  }
                                : question,
                            ),
                          })
                        }
                      >
                        {t("adminManage.remove")}
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  className="btn btn-light mt-2"
                  type="button"
                  disabled={q.choices.length >= 50}
                  onClick={() =>
                    setValues({
                      ...values,
                      questions: values.questions.map((question, i) =>
                        i === index
                          ? {
                              ...question,
                              choices: [
                                ...question.choices,
                                { text: "", score: 0, sort_order: question.choices.length },
                              ],
                            }
                          : question,
                      ),
                    })
                  }
                >
                  {t("adminManage.addChoice")}
                </button>
              </DetailBox>
            ))}
          </Row>
          <button
            type="button"
            className="btn btn-light mb-3"
            disabled={values.questions.length >= 100}
            onClick={() =>
              setValues({
                ...values,
                questions: [
                  ...values.questions,
                  {
                    text: "",
                    sort_order: values.questions.length,
                    choices: [{ text: "", score: 0, sort_order: 0 }],
                  },
                ],
              })
            }
          >
            {t("adminManage.addQuestion")}
          </button>
          <Row>
            <DetailBox
              id="questionnaire-recommendations"
              title={t("adminManage.recommendations")}
              icon="ri-award-line"
              columns={12}
            >
              <Row>
                {values.recommendations.map((rec, index) => (
                  <Col lg={6} key={recommendationKeys[index]}>
                    <fieldset className="border rounded p-3 mb-3">
                      <legend className="fs-14">
                        {t("adminManage.recommendation")} {formatProductNumber(index + 1, locale)}
                      </legend>
                      <label className="form-label d-block">
                        {t("adminManage.title")}
                        <input
                          dir="auto"
                          className="form-control mb-2"
                          required
                          maxLength={255}
                          value={rec.title}
                          onChange={(event) =>
                            setValues({
                              ...values,
                              recommendations: values.recommendations.map((r, i) =>
                                i === index ? { ...r, title: event.target.value } : r,
                              ),
                            })
                          }
                        />
                      </label>
                      <div className="row">
                        {(["min_score", "max_score", "priority"] as const).map((key) => (
                          <label className="col-md-4 form-label" key={key}>
                            {t(`adminManage.${key}`)}
                            <input
                              className="form-control mb-2"
                              required
                              type="number"
                              step={1}
                              value={rec[key]}
                              onChange={(event) =>
                                setValues({
                                  ...values,
                                  recommendations: values.recommendations.map((r, i) =>
                                    i === index ? { ...r, [key]: Number(event.target.value) } : r,
                                  ),
                                })
                              }
                            />
                          </label>
                        ))}
                      </div>
                      <QuestionnaireRichTextEditor
                        id={`questionnaire-recommendation-editor-${recommendationKeys[index]}`}
                        label={t("adminManage.body")}
                        value={rec.body_html}
                        disabled={!!target || uncertain}
                        onValidityChange={richValidity(
                          `recommendation-${recommendationKeys[index]}`,
                        )}
                        onChange={(html) =>
                          setValues((previous) => ({
                            ...previous,
                            recommendations: previous.recommendations.map((r, i) =>
                              i === index ? { ...r, body_html: html } : r,
                            ),
                          }))
                        }
                      />
                      <button
                        type="button"
                        className="btn btn-light"
                        onClick={() => {
                          setRecommendationKeys((keys) => keys.filter((_key, i) => i !== index));
                          setValues({
                            ...values,
                            recommendations: values.recommendations.filter((_r, i) => i !== index),
                          });
                        }}
                      >
                        {t("adminManage.remove")}
                      </button>
                    </fieldset>
                  </Col>
                ))}
              </Row>
              <button
                type="button"
                className="btn btn-light"
                disabled={values.recommendations.length >= 100}
                onClick={() => {
                  setRecommendationKeys((keys) => [...keys, crypto.randomUUID()]);
                  setValues({
                    ...values,
                    recommendations: [
                      ...values.recommendations,
                      {
                        title: "",
                        body_html: null,
                        min_score: 0,
                        max_score: 0,
                        priority: values.recommendations.length,
                        conditions: null,
                      },
                    ],
                  });
                }}
              >
                {t("adminManage.addRecommendation")}
              </button>
            </DetailBox>
          </Row>
          <div className="d-flex flex-wrap gap-2 mb-4">
            <button type="submit" className="btn btn-primary" disabled={!richValid}>
              {t("adminManage.save")}
            </button>
            {row ? (
              <button type="button" className="btn btn-danger" onClick={() => confirm(true)}>
                {t("adminManage.archive")}
              </button>
            ) : null}
          </div>
        </fieldset>
      </form>
      {uncertain ? (
        <p className="alert alert-warning" role="alert">
          {t("adminManage.uncertain")}
        </p>
      ) : null}
      {target ? (
        <ActionDialog
          target={target}
          onUncertain={() => setUncertain(true)}
          onClose={() => setTarget(null)}
          onSaved={onSaved}
        />
      ) : null}
    </>
  );
}
export default function QuestionnaireDetail() {
  const { capabilities } = useShellAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { questionnaireId = "" } = useParams();
  const [search] = useSearchParams();
  const create = questionnaireId === "0";
  const valid = create || validNumericId(questionnaireId);
  const { currentData, isFetching, error, refetch } = useAdminQuestionnaireQuery(
    Number(questionnaireId),
    { skip: create || !valid || !capabilities.accessAdminPanel, refetchOnMountOrArgChange: true },
  );
  if (!capabilities.accessAdminPanel) return <p role="alert">{t("adminReservations.denied")}</p>;
  return (
    <div className="page-content">
      <Container fluid>
        <BreadCrumb
          title={t("adminManage.definition")}
          pageTitle={t("adminManage.questionnaires")}
        />
        <Card>
          <CardBody className="d-flex flex-wrap gap-2">
            <Link className="btn btn-light" to={`/questionnaires?${search.toString()}`}>
              {t("adminManage.back")}
            </Link>
            {!create ? (
              <button
                className="btn btn-light"
                disabled={isFetching || !valid}
                onClick={() => void refetch()}
              >
                {t("adminReservations.refresh")}
              </button>
            ) : null}
          </CardBody>
        </Card>
        {!valid || error ? (
          <p role="alert" className="alert alert-warning">
            {t("adminManage.unavailable")}
          </p>
        ) : !create && isFetching ? (
          <output>{t("adminManage.loading")}</output>
        ) : create || currentData ? (
          <Editor
            key={currentData?.version ?? "create"}
            row={create ? undefined : currentData}
            onSaved={() => navigate("/questionnaires", { replace: true })}
          />
        ) : null}
      </Container>
    </div>
  );
}
