import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button, Card, CardBody, CardHeader, Col, Container, Input, Label, Row } from "reactstrap";
import BreadCrumb from "../../Components/Common/BreadCrumb";
import { ErrorState, LoadingState } from "../../modules/checkupino/feedback";
import {
  useQuestionnaireDefinitionQuery,
  useSubmitDemoQuestionnaireMutation,
} from "../../modules/checkupino/questionnaire/api";
import {
  completeAnswers,
  definitionFingerprint,
  demoTranslationKey,
  questionnaireText,
  DEMO_QUESTIONNAIRE_SLUG,
} from "../../modules/checkupino/questionnaire/definition";
import type {
  QuestionnaireDefinition,
  QuestionnaireResult,
} from "../../modules/checkupino/questionnaire/definition";
import {
  formatProductNumber,
  normalizeProductLocale,
} from "../../modules/checkupino/preferences/localization";

const DELIVERY_KEY = "checkupino.questionnaire.demo.pending";
const pendingDelivery = () => {
  try {
    return sessionStorage.getItem(DELIVERY_KEY) === "pending";
  } catch {
    return true;
  }
};

const PatientQuestionnaire = ({
  slug = DEMO_QUESTIONNAIRE_SLUG,
  embedded = false,
}: {
  readonly slug?: string;
  readonly embedded?: boolean;
}) => {
  const { t, i18n } = useTranslation();
  const locale = normalizeProductLocale(i18n.resolvedLanguage);
  const query = useQuestionnaireDefinitionQuery(slug, { refetchOnMountOrArgChange: true });
  const [sendSubmission, mutation] = useSubmitDemoQuestionnaireMutation();
  const [reviewedDefinition, setDefinition] = useState<QuestionnaireDefinition | null>(null);
  const definition = reviewedDefinition ?? query.currentData ?? null;
  const [selected, setSelected] = useState<Record<number, number>>({});
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<QuestionnaireResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [changed, setChanged] = useState(false);
  const [uncertain, setUncertain] = useState(pendingDelivery);
  const [error, setError] = useState<unknown>(null);
  const mounted = useRef(false),
    submitting = useRef(false);
  const active = useRef<{ abort(): void } | null>(null);
  const busy = checking || mutation.isLoading;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      active.current?.abort();
    };
  }, []);
  useEffect(() => {
    document.title = t("questionnaire.title");
  }, [t]);
  const display = (text: string) => {
    const key = definition && demoTranslationKey(definition, text);
    return locale === "fa" && key ? t(key) : text;
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!definition || busy || submitting.current || uncertain || result) return;
    if (
      !completeAnswers(definition, selected) ||
      !name.trim() ||
      !phone.trim() ||
      name.trim().length > 255 ||
      phone.trim().length > 30
    ) {
      setInvalid(true);
      return;
    }
    submitting.current = true;
    setChecking(true);
    setError(null);
    setInvalid(false);
    setChanged(false);
    let sent = false;
    try {
      const request = query.refetch();
      active.current = request;
      const fresh = await request.unwrap();
      if (!mounted.current) return;
      if (definitionFingerprint(fresh) !== definitionFingerprint(definition)) {
        setDefinition(fresh);
        setSelected({});
        setChanged(true);
        return;
      }
      // A reload cannot turn an ambiguous delivery into an automatic duplicate.
      sessionStorage.setItem(DELIVERY_KEY, "pending");
      sent = true;
      const delivery = sendSubmission({
        slug,
        submitter_name: name.trim(),
        submitter_phone: phone.trim(),
        answers: fresh.questions.map((question) => ({
          question_id: question.id,
          choice_id: selected[question.id],
        })),
      });
      active.current = delivery;
      const receipt = await delivery.unwrap();
      if (!mounted.current) return;
      if (
        !/^[0-9A-HJKMNP-TV-Z]{26}$/i.test(receipt.submission_id) ||
        !Number.isSafeInteger(receipt.total_score) ||
        (receipt.recommendation !== null &&
          (typeof receipt.recommendation?.title !== "string" ||
            typeof receipt.recommendation.body_html !== "string"))
      ) {
        setUncertain(true);
        return;
      }
      sessionStorage.removeItem(DELIVERY_KEY);
      setResult(receipt);
    } catch (failure) {
      if (!mounted.current) return;
      setError(failure);
      if (sent) {
        if (
          typeof failure === "object" &&
          failure !== null &&
          "kind" in failure &&
          failure.kind === "validation"
        )
          sessionStorage.removeItem(DELIVERY_KEY);
        else setUncertain(true);
      }
    } finally {
      active.current = null;
      submitting.current = false;
      if (mounted.current) setChecking(false);
    }
  };
  return (
    <div className={embedded ? "pb-4" : "page-content"}>
      <Container fluid>
        {!embedded && (
          <BreadCrumb title={t("questionnaire.title")} pageTitle={t("booking.patientPanel")} />
        )}
        <Row>
          <Col xl={8}>
            <Card>
              <CardHeader>
                <h5 className="card-title mb-0">{t("questionnaire.title")}</h5>
              </CardHeader>
              <CardBody>
                {!definition && query.isFetching && <LoadingState locale={locale} />}
                {Boolean(query.error) && (
                  <ErrorState
                    error={query.error}
                    locale={locale}
                    onRetry={() => void query.refetch()}
                  />
                )}
                {Boolean(error) && <ErrorState error={error} locale={locale} />}
                {invalid && (
                  <p className="alert alert-warning" role="alert">
                    {t("questionnaire.invalid")}
                  </p>
                )}
                {changed && (
                  <p className="alert alert-warning" role="alert">
                    {t("questionnaire.changed")}
                  </p>
                )}
                {uncertain && (
                  <p className="alert alert-warning" role="alert">
                    {t("questionnaire.uncertain")}
                  </p>
                )}
                {definition && (
                  <>
                    <div className="bg-primary-subtle rounded p-4 mb-4">
                      <span className="avatar-sm mb-3 d-block">
                        <span className="avatar-title rounded-circle bg-primary fs-2">
                          <i className="ri-heart-pulse-line" />
                        </span>
                      </span>
                      <h1 className="h4">{display(definition.title)}</h1>
                      <p className="text-muted mb-0">{t("questionnaire.formIntro")}</p>
                    </div>
                    <p>{display(questionnaireText(definition.content_html))}</p>
                    {result ? (
                      <output className="d-block">
                        <h5>{t("questionnaire.submitted")}</h5>
                        <p>
                          {t("questionnaire.submissionId")}:{" "}
                          <span dir="ltr">{result.submission_id}</span>
                        </p>
                        <p>
                          {t("questionnaire.score")}:{" "}
                          {formatProductNumber(result.total_score, locale)}
                        </p>
                        {result.recommendation ? (
                          <>
                            <h6>{display(result.recommendation.title)}</h6>
                            <p>{display(questionnaireText(result.recommendation.body_html))}</p>
                          </>
                        ) : (
                          <p>{t("questionnaire.noRecommendation")}</p>
                        )}
                      </output>
                    ) : (
                      <form onSubmit={(event) => void submit(event)}>
                        <fieldset disabled={busy || uncertain}>
                          <div className="mb-3">
                            <Label htmlFor="questionnaire-name">{t("questionnaire.name")}</Label>
                            <Input
                              id="questionnaire-name"
                              required
                              maxLength={255}
                              autoComplete="name"
                              value={name}
                              onChange={(event) => setName(event.target.value)}
                            />
                          </div>
                          <div className="mb-3">
                            <Label htmlFor="questionnaire-phone">{t("questionnaire.phone")}</Label>
                            <Input
                              id="questionnaire-phone"
                              type="tel"
                              dir="ltr"
                              required
                              maxLength={30}
                              autoComplete="tel"
                              value={phone}
                              onChange={(event) => setPhone(event.target.value)}
                            />
                          </div>
                          <div className="mb-4">
                            <p className="small text-muted">
                              {t("questionnaire.progress", {
                                answered: formatProductNumber(Object.keys(selected).length, locale),
                                total: formatProductNumber(definition.questions.length, locale),
                              })}
                            </p>
                            <progress
                              className="visually-hidden"
                              aria-label={t("questionnaire.yourResponses")}
                              value={Object.keys(selected).length}
                              max={definition.questions.length}
                            />
                            <div className="progress" aria-hidden="true">
                              <div
                                className="progress-bar bg-success"
                                style={{
                                  width:
                                    (definition.questions.length
                                      ? (Object.keys(selected).length /
                                          definition.questions.length) *
                                        100
                                      : 0) + "%",
                                }}
                              />
                            </div>
                          </div>
                          {definition.questions.map((question, index) => (
                            <fieldset className="border rounded p-3 mb-4" key={question.id}>
                              <legend className="fs-14 fw-semibold float-none w-auto px-2">
                                <span className="badge bg-primary-subtle text-primary me-2">
                                  {formatProductNumber(index + 1, locale)}
                                </span>
                                {display(question.text)}
                              </legend>
                              {question.choices.map((choice) => (
                                <div
                                  className={
                                    "form-check border rounded p-3 ps-5 mb-2 " +
                                    (selected[question.id] === choice.id
                                      ? "border-primary bg-primary-subtle"
                                      : "")
                                  }
                                  key={choice.id}
                                >
                                  <Input
                                    className="form-check-input"
                                    type="radio"
                                    required
                                    id={`questionnaire-choice-${choice.id}`}
                                    name={`questionnaire-question-${question.id}`}
                                    checked={selected[question.id] === choice.id}
                                    onChange={() =>
                                      setSelected((previous) => ({
                                        ...previous,
                                        [question.id]: choice.id,
                                      }))
                                    }
                                  />
                                  <Label
                                    className="form-check-label"
                                    htmlFor={`questionnaire-choice-${choice.id}`}
                                  >
                                    {display(choice.text)}
                                  </Label>
                                </div>
                              ))}
                            </fieldset>
                          ))}
                          <Button color="primary" type="submit">
                            {t("questionnaire.submit")}
                          </Button>
                        </fieldset>
                        {busy && (
                          <LoadingState
                            locale={locale}
                            label={t(
                              mutation.isLoading
                                ? "questionnaire.sending"
                                : "questionnaire.checking",
                            )}
                          />
                        )}
                      </form>
                    )}
                  </>
                )}
              </CardBody>
            </Card>
          </Col>
          <Col xl={4}>
            <Card className="bg-success-subtle">
              <CardBody className="p-4">
                <i className="ri-shield-check-line display-4 text-success" />
                <h2 className="h5 mt-3">{t("questionnaire.aboutResult")}</h2>
                <p className="text-muted mb-0">{t("questionnaire.resultHint")}</p>
              </CardBody>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
};
export default PatientQuestionnaire;
