import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, RecentPasswordDialog } from "../../modules/checkupino/overlays";
import { clinicalRequest, locationOptions } from "../../modules/checkupino/profiles/onboarding";
import {
  readPractice,
  practiceReceipt,
  type DoctorPractice,
} from "../../modules/checkupino/profiles/practice";
import {
  useClinicalRead,
  useClinicalWrite,
} from "../../modules/checkupino/profiles/useClinicalWrite";
import { normalizeProductLocale } from "../../modules/checkupino/preferences/localization";

export default function DoctorLocationEditor({
  practice,
  workplaceId,
  onClose,
  onSaved,
  onRefresh,
}: {
  readonly practice: DoctorPractice;
  readonly workplaceId: number;
  readonly onClose: () => void;
  readonly onSaved: () => void;
  readonly onRefresh: () => void;
}) {
  const { t, i18n } = useTranslation(),
    write = useClinicalWrite("location-" + workplaceId);
  const workplace = practice.workplaces.find((w) => w.id === workplaceId);
  const formId = useId();
  const [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(1);
  const [hospitalId, setHospitalId] = useState("");
  const [services, setServices] = useState<{ id: number; price: number; currency: string }[]>(
    () =>
      workplace?.services
        .filter((s) => s.active)
        .map((s) => ({
          id: s.id,
          price: s.price ?? practice.professional.fee,
          currency: s.currency ?? "IRR",
        })) ?? [],
  );
  const [reason, setReason] = useState(""),
    [confirmed, setConfirmed] = useState(false);
  const optionRead = useClinicalRead(
    "/api/doctor/location-options?" + new URLSearchParams({ q: query, page: String(page) }),
    locationOptions,
  );
  const options = optionRead.data?.owner_id === practice.owner_id ? optionRead.data : null;
  const failed = optionRead.error || (!!optionRead.data && !options);
  const selected = options?.hospitals.find((h) => h.public_id === hospitalId);
  const valid =
    options &&
    (workplace || selected) &&
    services.length > 0 &&
    services.length <= 30 &&
    reason.trim().length > 0 &&
    confirmed &&
    services.every(
      (s) =>
        Number.isSafeInteger(s.price) &&
        s.price >= 0 &&
        s.price <= 2147483647 &&
        /^[A-Z]{3}$/.test(s.currency),
    );
  return (
    <>
      <Dialog
        open={!write.password.request}
        busy={write.busy}
        size="lg"
        locale={normalizeProductLocale(i18n.resolvedLanguage)}
        title={t(workplace ? "onboarding.doctorPrices" : "onboarding.addLocation")}
        onClose={onClose}
      >
        <p className="alert alert-info">{t("onboarding.doctorPriceNotice")}</p>
        {write.failure && (
          <p role="alert" className="alert alert-danger">
            {t(write.failure)}
          </p>
        )}
        {write.uncertain && (
          <p role="alert" className="alert alert-warning">
            {t("onboarding.uncertain")}
          </p>
        )}
        {failed ? (
          <p role="alert">{t("adminManage.unavailable")}</p>
        ) : !options ? (
          <output>{t("onboarding.loading")}</output>
        ) : (
          <>
            {!workplace && (
              <form
                className="d-flex gap-2 mb-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  setHospitalId("");
                  setPage(1);
                  setQuery(search.trim());
                }}
              >
                <label className="visually-hidden" htmlFor="doctor-hospital-search">
                  {t("onboarding.searchHospitals")}
                </label>
                <input
                  id="doctor-hospital-search"
                  className="form-control"
                  value={search}
                  maxLength={160}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <button className="btn btn-light" type="submit">
                  {t("onboarding.search")}
                </button>
              </form>
            )}
            <form
              id={formId}
              onSubmit={(event) => {
                event.preventDefault();
                if (!valid || !options) return;
                const body = {
                  services,
                  reason: reason.trim(),
                  confirmed: true,
                  expected_revision: practice.revision,
                  ...(!workplace && selected
                    ? {
                        hospital_public_id: selected.public_id,
                        hospital_revision: selected.revision,
                      }
                    : {}),
                };
                void write.run(
                  readPractice,
                  practice.revision,
                  async (signal) => {
                    const saved = await clinicalRequest(
                      workplace ? "PUT" : "POST",
                      workplace
                        ? `/api/doctor/locations/${workplace.id}/services`
                        : "/api/doctor/locations",
                      practiceReceipt,
                      signal,
                      body,
                    );
                    if (
                      saved.owner_id !== practice.owner_id ||
                      saved.revision === practice.revision
                    )
                      throw new Error("Practice receipt rejected");
                    return saved;
                  },
                  onSaved,
                );
              }}
            >
              <fieldset disabled={write.busy || write.uncertain}>
                {workplace ? (
                  <h2 className="h5" dir="auto">
                    {workplace.name}
                  </h2>
                ) : (
                  <>
                    <label className="form-label" htmlFor="doctor-hospital">
                      {t("booking.workplace")}
                    </label>
                    <select
                      id="doctor-hospital"
                      className="form-select mb-3"
                      required
                      value={hospitalId}
                      onChange={(event) => setHospitalId(event.target.value)}
                    >
                      <option value="">{t("booking.notSelected")}</option>
                      {options.hospitals.map((h) => (
                        <option key={h.public_id} value={h.public_id}>
                          {h.name}
                          {h.city ? " / " + h.city : ""}
                        </option>
                      ))}
                    </select>
                    {selected && (
                      <p dir="auto">
                        {selected.address} <bdi>{selected.timezone}</bdi>
                      </p>
                    )}
                    {!options.hospitals.length && <p>{t("onboarding.noHospitals")}</p>}
                    <div className="d-flex gap-2 mb-3">
                      <button
                        className="btn btn-light btn-sm"
                        type="button"
                        disabled={page <= 1}
                        onClick={() => {
                          setHospitalId("");
                          setPage((value) => value - 1);
                        }}
                      >
                        {t("onboarding.previous")}
                      </button>
                      <button
                        className="btn btn-light btn-sm"
                        type="button"
                        disabled={page >= options.last_page}
                        onClick={() => {
                          setHospitalId("");
                          setPage((value) => value + 1);
                        }}
                      >
                        {t("onboarding.next")}
                      </button>
                    </div>
                  </>
                )}
                <h3 className="h6">{t("onboarding.servicePrices")}</h3>
                {options.services.map((service) => {
                  const chosen = services.find((s) => s.id === service.id),
                    existing = workplace?.services.some((s) => s.id === service.id && s.active);
                  return (
                    <div className="border rounded p-3 mb-2" key={service.id}>
                      <label className="form-check">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={!!chosen}
                          disabled={existing || (!chosen && services.length >= 30)}
                          onChange={(event) =>
                            setServices((rows) =>
                              event.target.checked
                                ? [
                                    ...rows,
                                    {
                                      id: service.id,
                                      price: practice.professional.fee,
                                      currency: service.currency,
                                    },
                                  ]
                                : rows.filter((s) => s.id !== service.id),
                            )
                          }
                        />
                        <span className="form-check-label">{service.title}</span>
                      </label>
                      {chosen && (
                        <div className="row g-2 mt-1">
                          <div className="col-sm-7">
                            <label
                              className="form-label"
                              htmlFor={"doctor-service-price-" + service.id}
                            >
                              {t("onboarding.servicePrice")}
                            </label>
                            <input
                              id={"doctor-service-price-" + service.id}
                              className="form-control"
                              type="number"
                              min={0}
                              max={2147483647}
                              step={1}
                              required
                              value={chosen.price}
                              onChange={(event) =>
                                setServices((rows) =>
                                  rows.map((s) =>
                                    s.id === service.id
                                      ? { ...s, price: Number(event.target.value) }
                                      : s,
                                  ),
                                )
                              }
                            />
                          </div>
                          <div className="col-sm-5">
                            <label
                              className="form-label"
                              htmlFor={"doctor-service-currency-" + service.id}
                            >
                              {t("catalog.currency")}
                            </label>
                            <input
                              id={"doctor-service-currency-" + service.id}
                              className="form-control"
                              pattern="[A-Z]{3}"
                              maxLength={3}
                              required
                              value={chosen.currency}
                              onChange={(event) =>
                                setServices((rows) =>
                                  rows.map((s) =>
                                    s.id === service.id
                                      ? { ...s, currency: event.target.value.toUpperCase() }
                                      : s,
                                  ),
                                )
                              }
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                <label className="form-label mt-3" htmlFor="doctor-location-reason">
                  {t("adminManage.reason")}
                </label>
                <textarea
                  id="doctor-location-reason"
                  className="form-control"
                  required
                  maxLength={1000}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
                <label className="form-check my-3">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                  />
                  <span className="form-check-label">{t("doctorPractice.confirm")}</span>
                </label>
              </fieldset>
            </form>
          </>
        )}
        <div className="d-flex flex-wrap align-items-center gap-2 mt-3">
          {options && !failed && (
            <button
              className="btn btn-primary"
              type="submit"
              form={formId}
              disabled={write.busy || write.uncertain || !valid}
            >
              {t(write.busy ? "users.saving" : "users.save")}
            </button>
          )}
          <button className="btn btn-light" type="button" disabled={write.busy} onClick={onClose}>
            {t("users.cancel")}
          </button>
          {write.uncertain && (
            <button
              className="btn btn-light"
              type="button"
              onClick={() => {
                void readPractice(new AbortController().signal)
                  .then((value) => {
                    if (value.owner_id === practice.owner_id) {
                      write.refresh();
                      onRefresh();
                    }
                  })
                  .catch(() => {});
              }}
            >
              {t("adminReservations.refresh")}
            </button>
          )}
        </div>
      </Dialog>
      <RecentPasswordDialog
        locale={normalizeProductLocale(i18n.resolvedLanguage)}
        onCancel={write.password.cancel}
        onSubmit={write.password.submit}
        request={write.password.request}
      />
    </>
  );
}
