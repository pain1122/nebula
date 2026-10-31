import { useDeferredValue, useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button, Card, CardBody, CardHeader, Container, Row, Col } from "reactstrap";
import BreadCrumb from "../../Components/Common/BreadCrumb";
import {
  useBookingCheckupsQuery,
  useBookingDoctorsQuery,
  useBookingSlotsQuery,
  useCreateBookingMutation,
  type BookingCheckup,
} from "../../modules/checkupino/booking/api";
import { EmptyState, ErrorState, LoadingState } from "../../modules/checkupino/feedback";
import {
  formatProductNumber,
  formatProductTimestamp,
  normalizeProductLocale,
} from "../../modules/checkupino/preferences/localization";
import { questionnaireText } from "../../modules/checkupino/questionnaire/definition";

const stages = ["checkup", "doctor", "workplace", "slot"] as const;
export default function PatientBooking() {
  const { t, i18n } = useTranslation(),
    locale = normalizeProductLocale(i18n.resolvedLanguage),
    navigate = useNavigate();
  const [step, setStep] = useState(0),
    [page, setPage] = useState(1),
    [search, setSearch] = useState("");
  const term = useDeferredValue(search.trim());
  const [checkup, setCheckup] = useState<BookingCheckup | null>(null),
    [doctorId, setDoctorId] = useState(0),
    [workplaceId, setWorkplaceId] = useState(0),
    [slotId, setSlotId] = useState("");
  const checkupId = checkup?.id ?? 0;
  const retryKey = useRef<{ slotId: string; key: string } | null>(null),
    submitting = useRef(false);
  const checkups = useBookingCheckupsQuery(
    { page, q: step === 0 ? term : "" },
    { refetchOnMountOrArgChange: true },
  );
  const doctors = useBookingDoctorsQuery(checkupId, {
    skip: !checkupId,
    refetchOnMountOrArgChange: true,
  });
  const slots = useBookingSlotsQuery(
    { checkupId, doctorId, workplaceId },
    { skip: !checkupId || !doctorId || !workplaceId, refetchOnMountOrArgChange: true },
  );
  const [createBooking, mutation] = useCreateBookingMutation();
  const doctor =
    !doctors.error && !doctors.isFetching
      ? doctors.currentData?.find((row) => row.doctor_profile_id === doctorId)
      : undefined;
  const workplaces = doctor?.workplaces ?? [],
    workplace = workplaces.find((row) => row.id === workplaceId);
  const slot =
    !slots.error && !slots.isFetching
      ? slots.currentData?.find((row) => row.slot_id === slotId)
      : undefined;
  const query = step === 0 ? checkups : step === 1 || step === 2 ? doctors : slots;
  const busy = mutation.isLoading || query.isFetching;
  const selected = [!!checkup, !!doctor, !!workplace, !!slot];
  useEffect(() => {
    document.title = t("booking.title");
  }, [t]);
  const resetSlot = () => {
    setSlotId("");
    retryKey.current = null;
    mutation.reset();
  };
  const move = (next: number) => {
    if (mutation.isLoading) return;
    setSearch("");
    setStep(next);
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step !== 3 || !slot || busy || submitting.current) return;
    submitting.current = true;
    if (retryKey.current?.slotId !== slot.slot_id)
      retryKey.current = { slotId: slot.slot_id, key: crypto.randomUUID() };
    try {
      await createBooking({ slotId: slot.slot_id, idempotencyKey: retryKey.current.key }).unwrap();
      void navigate("/my/reservations", { state: { bookingCreated: true } });
    } catch {
      /* Keep the same key when delivery is uncertain. */
    } finally {
      submitting.current = false;
    }
  };
  const matches = (text: string) =>
    text.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
  const time = (value: string) =>
    new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en-US", {
      timeZone: workplace?.timezone ?? "Asia/Tehran",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(value));
  const choices =
    step === 0
      ? (checkups.currentData?.items ?? [])
      : step === 1
        ? (doctors.currentData ?? []).filter((row) =>
            matches(row.doctor_name + " " + (row.specialty ?? "")),
          )
        : step === 2
          ? workplaces.filter((row) => matches(row.name))
          : (slots.currentData ?? []);
  const choiceClass = (active: boolean) =>
    "card card-animate w-100 h-100 text-start p-0 border " +
    (active ? "border-primary bg-primary-subtle" : "bg-body");
  return (
    <div className="page-content">
      <Container fluid>
        <BreadCrumb title={t("booking.title")} pageTitle={t("booking.patientPanel")} />
        <Card className="bg-primary-subtle">
          <CardBody className="p-4">
            <div className="d-flex align-items-center gap-3 mb-4">
              <span className="avatar-md">
                <span className="avatar-title rounded-circle bg-primary fs-1">
                  <i className="ri-calendar-2-line" />
                </span>
              </span>
              <div>
                <h1 className="h3 mb-1">{t("booking.findCare")}</h1>
                <p className="text-muted mb-0">{t("booking.findCareIntro")}</p>
              </div>
            </div>
            <Row className="g-2">
              {stages.map((key, index) => (
                <Col xs={6} md={3} key={key}>
                  <button
                    type="button"
                    className={
                      "btn w-100 text-start d-flex gap-2 align-items-center p-3 " +
                      (step === index
                        ? "btn-primary"
                        : selected[index]
                          ? "btn-soft-success"
                          : "btn-light")
                    }
                    aria-current={step === index ? "step" : undefined}
                    disabled={
                      mutation.isLoading || (index > 0 && !selected.slice(0, index).every(Boolean))
                    }
                    onClick={() => move(index)}
                  >
                    <span className="badge rounded-pill bg-body text-primary">
                      {formatProductNumber(index + 1, locale)}
                    </span>
                    {t("booking." + key)}
                  </button>
                </Col>
              ))}
            </Row>
          </CardBody>
        </Card>
        <Row>
          <Col lg={8}>
            <Card>
              <CardHeader>
                <h2 className="h5 mb-0">{t("booking.chooseAppointment")}</h2>
              </CardHeader>
              <CardBody>
                <nav aria-label={t("booking.selectionPath")}>
                  <ol className="breadcrumb flex-wrap mb-4">
                    {stages.slice(0, step + 1).map((key, index) => (
                      <li className="breadcrumb-item" key={key}>
                        <button
                          type="button"
                          className={
                            "btn btn-link p-0 " +
                            (step === index ? "text-primary fw-semibold" : "text-muted")
                          }
                          aria-current={step === index ? "step" : undefined}
                          disabled={mutation.isLoading}
                          onClick={() => move(index)}
                        >
                          {t("booking." + key)}
                        </button>
                      </li>
                    ))}
                  </ol>
                </nav>
                <form onSubmit={submit}>
                  <fieldset disabled={mutation.isLoading}>
                    <legend className="h4 mb-3">{t("booking." + stages[step])}</legend>
                    {step < 3 && (
                      <div className="mb-4">
                        <label htmlFor="booking-search" className="form-label">
                          {t("booking.filterChoices")}
                        </label>
                        <input
                          id="booking-search"
                          className="form-control"
                          value={search}
                          onChange={(event) => {
                            setSearch(event.target.value);
                            if (step === 0) setPage(1);
                          }}
                        />
                      </div>
                    )}
                    {query.isFetching ? (
                      <LoadingState locale={locale} />
                    ) : query.error ? (
                      <ErrorState
                        error={query.error}
                        locale={locale}
                        onRetry={() => void query.refetch()}
                      />
                    ) : (
                      <>
                        {step === 0 && (
                          <Row className="g-3">
                            {checkups.currentData?.items.map((item) => (
                              <Col md={6} key={item.id}>
                                <button
                                  type="button"
                                  className={choiceClass(checkupId === item.id)}
                                  aria-pressed={checkupId === item.id}
                                  aria-label={t("booking.chooseService", { name: item.title })}
                                  onClick={() => {
                                    if (checkupId !== item.id) {
                                      setCheckup(item);
                                      setDoctorId(0);
                                      setWorkplaceId(0);
                                      resetSlot();
                                    }
                                  }}
                                >
                                  <span className="card-body">
                                    <i
                                      className="ri-heart-pulse-line fs-1 text-primary"
                                      aria-hidden="true"
                                    />
                                    <strong className="d-block fs-5 my-2" dir="auto">
                                      {item.title}
                                    </strong>
                                    <span className="d-block text-muted text-break" dir="auto">
                                      {questionnaireText(item.description ?? null) ||
                                        t("booking.descriptionMissing")}
                                    </span>
                                  </span>
                                </button>
                              </Col>
                            ))}
                          </Row>
                        )}
                        {step === 1 && (
                          <Row className="g-3">
                            {(doctors.currentData ?? [])
                              .filter((row) =>
                                matches(row.doctor_name + " " + (row.specialty ?? "")),
                              )
                              .map((item) => (
                                <Col md={6} key={item.doctor_profile_id}>
                                  <button
                                    type="button"
                                    className={choiceClass(doctorId === item.doctor_profile_id)}
                                    aria-pressed={doctorId === item.doctor_profile_id}
                                    aria-label={t("booking.chooseDoctor", {
                                      name: item.doctor_name,
                                    })}
                                    onClick={() => {
                                      if (doctorId !== item.doctor_profile_id) {
                                        setDoctorId(item.doctor_profile_id);
                                        setWorkplaceId(0);
                                        resetSlot();
                                      }
                                    }}
                                  >
                                    <span className="card-body">
                                      <span className="avatar-lg d-block mb-3">
                                        <span
                                          className="avatar-title rounded-circle bg-info-subtle text-info fs-2"
                                          aria-label={t("booking.photoMissing")}
                                        >
                                          {Array.from(item.doctor_name).slice(0, 1)}
                                        </span>
                                      </span>
                                      <strong className="d-block fs-5" dir="auto">
                                        {item.doctor_name}
                                      </strong>
                                      <span className="d-block text-muted my-2" dir="auto">
                                        {item.specialty ?? t("booking.specialtyMissing")}
                                      </span>
                                      <span className="d-block">
                                        {t("booking.experienceYears", {
                                          years: formatProductNumber(
                                            item.experience_years ?? 0,
                                            locale,
                                          ),
                                        })}
                                      </span>
                                      <span className="d-block text-muted mt-2">
                                        <i
                                          className="ri-star-line text-warning"
                                          aria-hidden="true"
                                        />{" "}
                                        {t("booking.ratingMissing")}
                                      </span>
                                      {item.price_ranges?.map((range) => (
                                        <span
                                          className="d-block fw-semibold mt-2"
                                          key={range.currency}
                                        >
                                          <bdi>
                                            {formatProductNumber(range.min, locale)}
                                            {range.max !== range.min
                                              ? " - " + formatProductNumber(range.max, locale)
                                              : ""}{" "}
                                            {range.currency}
                                          </bdi>
                                        </span>
                                      ))}
                                      <small className="d-block text-muted mt-2">
                                        {t("booking.indicativePrice")}
                                      </small>
                                    </span>
                                  </button>
                                </Col>
                              ))}
                          </Row>
                        )}
                        {step === 2 && (
                          <Row className="g-3">
                            {workplaces
                              .filter((row) => matches(row.name))
                              .map((item) => (
                                <Col md={6} key={item.id}>
                                  <button
                                    type="button"
                                    className={choiceClass(workplaceId === item.id)}
                                    aria-pressed={workplaceId === item.id}
                                    aria-label={t("booking.chooseLocation", { name: item.name })}
                                    onClick={() => {
                                      if (workplaceId !== item.id) {
                                        setWorkplaceId(item.id);
                                        resetSlot();
                                      }
                                    }}
                                  >
                                    <span className="card-body">
                                      <i
                                        className="ri-map-pin-line fs-1 text-info"
                                        aria-hidden="true"
                                      />
                                      <strong className="d-block fs-5 my-2" dir="auto">
                                        {item.name}
                                      </strong>
                                      <bdi className="text-muted">{item.timezone}</bdi>
                                    </span>
                                  </button>
                                </Col>
                              ))}
                          </Row>
                        )}
                        {step === 3 && (
                          <div className="list-group">
                            {slots.currentData?.map((item) => (
                              <button
                                type="button"
                                key={item.slot_id}
                                className={
                                  "list-group-item list-group-item-action d-flex align-items-center justify-content-between gap-3 flex-wrap " +
                                  (slotId === item.slot_id ? "active" : "")
                                }
                                aria-pressed={slotId === item.slot_id}
                                onClick={() => {
                                  if (slotId !== item.slot_id) {
                                    setSlotId(item.slot_id);
                                    retryKey.current = null;
                                    mutation.reset();
                                  }
                                }}
                              >
                                <span>
                                  <strong className="d-block">
                                    {formatProductTimestamp(item.start, locale)}
                                  </strong>
                                  <span className="d-block">
                                    {time(item.start)} - {time(item.end)}
                                  </span>
                                </span>
                                <bdi className="fw-semibold">
                                  {formatProductNumber(item.price, locale)} {item.currency}
                                </bdi>
                              </button>
                            ))}
                          </div>
                        )}
                        {!choices.length && (
                          <EmptyState
                            locale={locale}
                            description={t(
                              step === 3
                                ? "booking.noSlots"
                                : step === 1
                                  ? "booking.noDoctors"
                                  : "booking.noChoices",
                            )}
                          />
                        )}
                        {step === 0 &&
                          checkups.currentData &&
                          checkups.currentData.page.lastPage > 1 && (
                            <div className="d-flex gap-2 mt-3">
                              <Button
                                type="button"
                                color="light"
                                disabled={page <= 1}
                                onClick={() => setPage(page - 1)}
                              >
                                {t("booking.previous")}
                              </Button>
                              <span className="align-self-center">
                                {formatProductNumber(page, locale)} /{" "}
                                {formatProductNumber(checkups.currentData.page.lastPage, locale)}
                              </span>
                              <Button
                                type="button"
                                color="light"
                                disabled={page >= checkups.currentData.page.lastPage}
                                onClick={() => setPage(page + 1)}
                              >
                                {t("booking.next")}
                              </Button>
                            </div>
                          )}
                      </>
                    )}
                    {mutation.error && <ErrorState locale={locale} error={mutation.error} />}
                    <div className="d-flex justify-content-between gap-2 border-top pt-3 mt-4">
                      <Button
                        type="button"
                        color="light"
                        disabled={step === 0 || mutation.isLoading}
                        onClick={() => move(step - 1)}
                      >
                        {t("booking.previous")}
                      </Button>
                      {step < 3 ? (
                        <Button
                          type="button"
                          color="primary"
                          disabled={!selected[step] || busy || !!query.error}
                          onClick={() => move(step + 1)}
                        >
                          {t("booking.nextStep")}
                        </Button>
                      ) : (
                        <Button type="submit" color="primary" disabled={!slot || busy}>
                          {mutation.isLoading ? t("booking.creating") : t("booking.confirm")}
                        </Button>
                      )}
                    </div>
                  </fieldset>
                </form>
              </CardBody>
            </Card>
          </Col>
          <Col lg={4}>
            <Card className="border border-info">
              <CardHeader>
                <h2 className="h5 mb-0">{t("booking.summary")}</h2>
              </CardHeader>
              <CardBody>
                <i className="ri-calendar-2-line display-4 text-info" />
                <dl className="mt-3 mb-0">
                  {[
                    ["checkup", checkup?.title],
                    ["doctor", doctor?.doctor_name],
                    ["workplace", workplace?.name],
                    ["slot", slot ? formatProductTimestamp(slot.start, locale) : null],
                  ].map(([key, value]) => (
                    <div className="border-bottom py-3" key={key}>
                      <dt className="text-muted mb-1">{t("booking." + key)}</dt>
                      <dd className="mb-0 fw-semibold text-break" dir="auto">
                        {value ?? t("booking.notSelected")}
                      </dd>
                    </div>
                  ))}
                  <div className="pt-3">
                    <dt>{t("booking.price")}</dt>
                    <dd>
                      <bdi className="fs-4 text-primary">
                        {slot
                          ? formatProductNumber(slot.price, locale) + " " + slot.currency
                          : t("booking.notSelected")}
                      </bdi>
                    </dd>
                  </div>
                </dl>
                <p className="text-muted mb-0">{t("booking.holdNotice")}</p>
              </CardBody>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
}
