import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Card, CardBody, CardHeader, Container } from "reactstrap";
import BreadCrumb from "../../Components/Common/BreadCrumb";
import { useShellAuth } from "../../Layouts/ShellAuthContext";
import {
  accountContext,
  accountReceipt,
  clinicalRequest,
} from "../../modules/checkupino/profiles/onboarding";
import {
  useClinicalRead,
  useClinicalWrite,
} from "../../modules/checkupino/profiles/useClinicalWrite";
import { RecentPasswordDialog } from "../../modules/checkupino/overlays";
import { normalizeProductLocale } from "../../modules/checkupino/preferences/localization";

function ClinicalAccountCreate({ accountRole }: { readonly accountRole: "doctor" | "patient" }) {
  const { t, i18n } = useTranslation(),
    { capabilities } = useShellAuth();
  const write = useClinicalWrite("account-" + accountRole);
  const contextRead = useClinicalRead(
    "/api/admin/clinical-accounts/create-context",
    accountContext,
    capabilities.manageMarketplaceUsers,
  );
  const context = contextRead.data;
  const [created, setCreated] = useState<string | null>(null);
  const [fields, setFields] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    birth_date: "",
    NID: "",
    password: "",
    password_confirmation: "",
    specialty_id: "",
    experience_years: "0",
    fee: "0",
    reason: "",
  });
  const [confirmed, setConfirmed] = useState(false),
    [verified, setVerified] = useState(false);
  const read = (signal: AbortSignal) =>
    clinicalRequest("GET", "/api/admin/clinical-accounts/create-context", accountContext, signal);
  const field = (key: keyof typeof fields, type = "text", maxLength = 100) => (
    <div className="col-md-6" key={key}>
      <label className="form-label" htmlFor={"clinical-" + key}>
        {t("onboarding.field." + key)}
      </label>
      <input
        id={"clinical-" + key}
        className="form-control"
        type={type}
        value={fields[key]}
        required
        maxLength={maxLength}
        autoComplete={type === "password" ? "new-password" : "off"}
        minLength={type === "password" ? 15 : undefined}
        pattern={key === "NID" ? "[0-9]{10}" : undefined}
        min={type === "number" ? 0 : undefined}
        max={key === "experience_years" ? 80 : key === "fee" ? 2147483647 : undefined}
        onChange={(event) => setFields((value) => ({ ...value, [key]: event.target.value }))}
      />
    </div>
  );
  const valid =
    context &&
    confirmed &&
    fields.reason.trim() &&
    (!fields.password || fields.password === fields.password_confirmation);
  const back = accountRole === "doctor" ? "/doctors" : "/patients";
  return (
    <div className="page-content">
      <Container fluid>
        <BreadCrumb
          title={t(accountRole === "doctor" ? "onboarding.newDoctor" : "onboarding.newPatient")}
          pageTitle={t("navigation.people")}
        />
        <Card>
          <CardHeader>
            <h1 className="h5 mb-0">
              {t(accountRole === "doctor" ? "onboarding.newDoctor" : "onboarding.newPatient")}
            </h1>
          </CardHeader>
          <CardBody>
            {!capabilities.manageMarketplaceUsers ? (
              <p role="alert">{t("adminManage.unavailable")}</p>
            ) : created ? (
              <div>
                <output className="alert alert-success">{t("users.saved")}</output>
                <Link
                  className="btn btn-primary me-2"
                  to={
                    "/users/" +
                    created +
                    "?directory=" +
                    (accountRole === "doctor" ? "doctors" : "patients")
                  }
                >
                  {t("onboarding.openProfile")}
                </Link>
              </div>
            ) : (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!valid || !context) return;
                  const body = {
                    role: accountRole,
                    ...Object.fromEntries(
                      Object.entries(fields).filter(
                        ([key]) => !["specialty_id", "fee", "experience_years"].includes(key),
                      ),
                    ),
                    ...(accountRole === "doctor"
                      ? {
                          specialty_id: Number(fields.specialty_id),
                          experience_years: Number(fields.experience_years),
                          fee: Number(fields.fee),
                          verified,
                        }
                      : {}),
                    reason: fields.reason.trim(),
                    confirmed: true,
                    expected_revision: context.revision,
                  };
                  void write.run(
                    read,
                    context.revision,
                    (signal) =>
                      clinicalRequest(
                        "POST",
                        "/api/admin/clinical-accounts",
                        accountReceipt.refine((receipt) => receipt.user.role === accountRole),
                        signal,
                        body,
                      ),
                    (receipt) => {
                      if (receipt.user.role !== accountRole) return;
                      setFields(
                        (value) =>
                          Object.fromEntries(
                            Object.keys(value).map((key) => [key, ""]),
                          ) as typeof value,
                      );
                      setCreated(receipt.user.public_id);
                    },
                  );
                }}
              >
                <p className="alert alert-info">{t("onboarding.identityNotice")}</p>
                {contextRead.error && <p role="alert">{t("adminManage.unavailable")}</p>}
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
                <fieldset disabled={write.busy || write.uncertain || !context}>
                  <div className="row g-3">
                    {field("first_name")}
                    {field("last_name")}
                    {field("email", "email", 255)}
                    {field("phone", "tel", 30)}
                    {field("birth_date", "date")}
                    {field("NID", "text", 10)}
                    {field("password", "password", 64)}
                    {field("password_confirmation", "password", 64)}
                    <p className="text-muted small mb-0">{t("users.passwordHelp")}</p>
                    {accountRole === "doctor" && (
                      <>
                        <div className="col-md-6">
                          <label className="form-label" htmlFor="clinical-specialty">
                            {t("doctorPractice.primary")}
                          </label>
                          <select
                            id="clinical-specialty"
                            className="form-select"
                            value={fields.specialty_id}
                            required
                            onChange={(event) =>
                              setFields((value) => ({ ...value, specialty_id: event.target.value }))
                            }
                          >
                            <option value="">{t("booking.notSelected")}</option>
                            {context?.specialties.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        {field("experience_years", "number")}
                        {field("fee", "number")}
                        <div className="col-12">
                          <label className="form-check">
                            <input
                              type="checkbox"
                              className="form-check-input"
                              checked={verified}
                              disabled={!context?.verification_on_create}
                              onChange={(event) => setVerified(event.target.checked)}
                            />
                            <span className="form-check-label">{t("onboarding.verifyDoctor")}</span>
                          </label>
                          <p className="text-muted small">{t("onboarding.verificationNotice")}</p>
                        </div>
                      </>
                    )}
                    <div className="col-12">
                      <label className="form-label" htmlFor="clinical-reason">
                        {t("adminManage.reason")}
                      </label>
                      <textarea
                        id="clinical-reason"
                        className="form-control"
                        required
                        maxLength={1000}
                        value={fields.reason}
                        onChange={(event) =>
                          setFields((value) => ({ ...value, reason: event.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <label className="form-check my-3">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={confirmed}
                      onChange={(event) => setConfirmed(event.target.checked)}
                    />
                    <span className="form-check-label">{t("doctorPractice.confirm")}</span>
                  </label>
                  <button className="btn btn-primary" type="submit" disabled={!valid}>
                    {t(write.busy ? "users.saving" : "users.create")}
                  </button>
                </fieldset>
                <button
                  className="btn btn-light mt-3"
                  type="button"
                  disabled={write.busy}
                  onClick={() => {
                    contextRead.refetch();
                    write.refresh();
                  }}
                >
                  {t("adminReservations.refresh")}
                </button>
              </form>
            )}
            <Link className="btn btn-light mt-3" to={back}>
              {t("onboarding.backToList")}
            </Link>
          </CardBody>
        </Card>
        <RecentPasswordDialog
          locale={normalizeProductLocale(i18n.resolvedLanguage)}
          onCancel={write.password.cancel}
          onSubmit={write.password.submit}
          request={write.password.request}
        />
      </Container>
    </div>
  );
}
export default function DoctorCreate() {
  return <ClinicalAccountCreate accountRole="doctor" />;
}
export function PatientCreate() {
  return <ClinicalAccountCreate accountRole="patient" />;
}
