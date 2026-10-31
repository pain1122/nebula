import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Card, CardBody, CardHeader, Container } from "reactstrap";
import BreadCrumb from "../../Components/Common/BreadCrumb";
import { useShellAuth } from "../../Layouts/ShellAuthContext";
import {
  clinicalRequest,
  createContext,
  hospitalDetail,
  hospitalList,
  hospitalReceipt,
  type Hospital,
  type HospitalInput,
} from "../../modules/checkupino/profiles/onboarding";
import {
  useClinicalRead,
  useClinicalWrite,
} from "../../modules/checkupino/profiles/useClinicalWrite";
import { RecentPasswordDialog } from "../../modules/checkupino/overlays";
import { normalizeProductLocale } from "../../modules/checkupino/preferences/localization";

export default function Hospitals() {
  const { t } = useTranslation(),
    { capabilities } = useShellAuth();
  const [parameters, setParameters] = useSearchParams();
  const [search, setSearch] = useState(parameters.get("q") ?? "");
  const query = parameters.toString();
  const listRead = useClinicalRead(
    "/api/admin/hospitals?" + query,
    hospitalList,
    capabilities.manageMarketplaceUsers,
  );
  const rows = listRead.data,
    failed = listRead.error;
  return (
    <div className="page-content">
      <Container fluid>
        <BreadCrumb title={t("adminManage.hospitals")} pageTitle={t("navigation.people")} />
        <Card>
          <CardHeader className="d-flex flex-wrap justify-content-between gap-2">
            <h1 className="h5 mb-0">{t("adminManage.hospitals")}</h1>
            {capabilities.manageMarketplaceUsers && (
              <Link to="/hospitals/new" className="btn btn-success">
                {t("onboarding.newHospital")}
              </Link>
            )}
          </CardHeader>
          <CardBody>
            <form
              className="d-flex gap-2 flex-wrap mb-3"
              onSubmit={(event) => {
                event.preventDefault();
                setParameters(search.trim() ? { q: search.trim() } : {});
              }}
            >
              <label className="visually-hidden" htmlFor="hospital-search">
                {t("onboarding.searchHospitals")}
              </label>
              <input
                id="hospital-search"
                className="form-control w-auto"
                value={search}
                maxLength={160}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("onboarding.searchHospitals")}
              />
              <button className="btn btn-primary" type="submit">
                {t("onboarding.search")}
              </button>
              <button
                className="btn btn-light"
                type="button"
                onClick={() => {
                  setSearch("");
                  setParameters({});
                }}
              >
                {t("operations.reset")}
              </button>
            </form>
            {!capabilities.manageMarketplaceUsers || failed ? (
              <p role="alert">{t("adminManage.unavailable")}</p>
            ) : !rows ? (
              <output>{t("onboarding.loading")}</output>
            ) : (
              <>
                <div className="row g-3">
                  {rows.hospitals.map((hospital) => (
                    <div className="col-md-6 col-xl-4" key={hospital.public_id}>
                      <Card className="border shadow-none h-100">
                        <CardBody>
                          <h2 className="h5" dir="auto">
                            {hospital.name}
                          </h2>
                          <p dir="auto">
                            {[hospital.province, hospital.city, hospital.address]
                              .filter(Boolean)
                              .join(" / ")}
                          </p>
                          <p>
                            <bdi>{hospital.timezone}</bdi>
                          </p>
                          <span
                            className={
                              "badge mb-3 " +
                              (hospital.is_active
                                ? "bg-success-subtle text-success"
                                : "bg-secondary-subtle text-secondary")
                            }
                          >
                            {t(hospital.is_active ? "onboarding.active" : "onboarding.inactive")}
                          </span>
                          <div>
                            <Link
                              className="btn btn-soft-primary"
                              to={"/hospitals/" + hospital.public_id}
                            >
                              {t("onboarding.details")}
                            </Link>
                          </div>
                        </CardBody>
                      </Card>
                    </div>
                  ))}
                </div>
                {!rows.hospitals.length && <p>{t("onboarding.noHospitals")}</p>}
                <div className="d-flex gap-2 mt-3">
                  <button
                    className="btn btn-light"
                    disabled={rows.page <= 1}
                    onClick={() =>
                      setParameters({
                        ...Object.fromEntries(parameters),
                        page: String(rows.page - 1),
                      })
                    }
                  >
                    {t("onboarding.previous")}
                  </button>
                  <button
                    className="btn btn-light"
                    disabled={rows.page >= rows.last_page}
                    onClick={() =>
                      setParameters({
                        ...Object.fromEntries(parameters),
                        page: String(rows.page + 1),
                      })
                    }
                  >
                    {t("onboarding.next")}
                  </button>
                </div>
              </>
            )}
          </CardBody>
        </Card>
      </Container>
    </div>
  );
}

export function HospitalPage({ creating = false }: { readonly creating?: boolean }) {
  const { hospitalId } = useParams(),
    { t } = useTranslation(),
    { capabilities } = useShellAuth();
  const [editing, setEditing] = useState(creating);
  const navigate = useNavigate();
  const validId = creating || (!!hospitalId && /^[0-9a-hjkmnp-tv-z]{26}$/i.test(hospitalId));
  const path = creating
    ? "/api/admin/hospitals/create-context"
    : "/api/admin/hospitals/" + hospitalId;
  const detailRead = useClinicalRead<{ hospital?: Hospital; revision: string }>(
    path,
    creating ? createContext : hospitalDetail,
    validId && capabilities.manageMarketplaceUsers,
  );
  const data = detailRead.data,
    failed = detailRead.error;
  return (
    <div className="page-content">
      <Container fluid>
        <BreadCrumb
          title={t(creating ? "onboarding.newHospital" : "adminManage.hospitals")}
          pageTitle={t("navigation.people")}
        />
        <Card>
          <CardHeader className="d-flex justify-content-between gap-2">
            <h1 className="h5 mb-0" dir="auto">
              {data?.hospital?.name ?? t("onboarding.newHospital")}
            </h1>
            {!creating && data?.hospital && !data.hospital.archived && (
              <button
                className="btn btn-primary"
                disabled={editing}
                onClick={() => setEditing(true)}
              >
                {t("onboarding.editHospital")}
              </button>
            )}
          </CardHeader>
          <CardBody>
            {!validId || !capabilities.manageMarketplaceUsers || failed ? (
              <p role="alert">{t("adminManage.unavailable")}</p>
            ) : !data ? (
              <output>{t("onboarding.loading")}</output>
            ) : editing ? (
              <HospitalForm
                key={data.revision}
                hospital={data.hospital}
                revision={data.revision}
                path={path}
                onRefresh={detailRead.refetch}
                onCancel={() => (creating ? navigate("/hospitals") : setEditing(false))}
                onSaved={() => {
                  setEditing(false);
                  detailRead.refetch();
                }}
              />
            ) : (
              <div className="row g-3">
                {data.hospital &&
                  Object.entries(data.hospital)
                    .filter(([key]) => !["public_id", "archived"].includes(key))
                    .map(([key, value]) => (
                      <div className="col-md-6" key={key}>
                        <div className="border rounded p-3 h-100">
                          <h2 className="h6">{t("onboarding.field." + key)}</h2>
                          <p
                            className="mb-0 text-break"
                            dir="auto"
                            style={{ whiteSpace: "pre-wrap" }}
                          >
                            {typeof value === "boolean"
                              ? t(value ? "onboarding.active" : "onboarding.inactive")
                              : value || "—"}
                          </p>
                        </div>
                      </div>
                    ))}
              </div>
            )}
            <Link className="btn btn-light mt-3" to="/hospitals">
              {t("onboarding.backToList")}
            </Link>
          </CardBody>
        </Card>
      </Container>
    </div>
  );
}
export function HospitalCreate() {
  return <HospitalPage creating />;
}

function HospitalForm({
  hospital,
  revision,
  path,
  onCancel,
  onSaved,
  onRefresh,
}: {
  readonly hospital?: Hospital;
  readonly revision: string;
  readonly path: string;
  readonly onCancel: () => void;
  readonly onSaved: () => void;
  readonly onRefresh: () => void;
}) {
  const { t, i18n } = useTranslation(),
    write = useClinicalWrite("hospital-" + (hospital?.public_id ?? "new"));
  const [data, setData] = useState<HospitalInput>(() =>
    hospital
      ? { ...hospital }
      : {
          name: "",
          slug: "",
          timezone: "Asia/Tehran",
          country_code: null,
          province: null,
          city: null,
          address: null,
          contact_phone: null,
          contact_email: null,
          website_url: null,
          profile: null,
          is_active: true,
        },
  );
  const [reason, setReason] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [created, setCreated] = useState<string | null>(null);
  const textKeys = [
    "name",
    "slug",
    "timezone",
    "country_code",
    "province",
    "city",
    "address",
    "contact_phone",
    "contact_email",
    "website_url",
    "profile",
  ] as const;
  return (
    <>
      {created ? (
        <div>
          <output className="alert alert-success">{t("users.saved")}</output>
          <Link className="btn btn-primary" to={"/hospitals/" + created}>
            {t("onboarding.details")}
          </Link>
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!confirmed || !reason.trim()) return;
            const body = {
              ...Object.fromEntries(
                Object.entries(data).filter(([key]) => key !== "public_id" && key !== "archived"),
              ),
              reason: reason.trim(),
              confirmed: true,
              expected_revision: revision,
            };
            void write.run(
              (signal) =>
                clinicalRequest("GET", path, hospital ? hospitalDetail : createContext, signal),
              revision,
              (signal) =>
                clinicalRequest(
                  hospital ? "PUT" : "POST",
                  hospital ? path : "/api/admin/hospitals",
                  hospitalReceipt,
                  signal,
                  body,
                ),
              (receipt) => {
                if (hospital) onSaved();
                else setCreated(receipt.hospital.public_id);
              },
            );
          }}
        >
          <p className="alert alert-info">{t("onboarding.hospitalPriceNotice")}</p>
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
          <fieldset disabled={write.busy || write.uncertain}>
            <div className="row g-3">
              {textKeys.map((key) => (
                <div
                  className={key === "profile" || key === "address" ? "col-12" : "col-md-6"}
                  key={key}
                >
                  <label className="form-label" htmlFor={"hospital-" + key}>
                    {t("onboarding.field." + key)}
                  </label>
                  {key === "profile" || key === "address" ? (
                    <textarea
                      id={"hospital-" + key}
                      className="form-control"
                      rows={3}
                      maxLength={key === "profile" ? 5000 : 2000}
                      value={data[key] ?? ""}
                      onChange={(event) =>
                        setData((value) => ({ ...value, [key]: event.target.value || null }))
                      }
                    />
                  ) : (
                    <input
                      id={"hospital-" + key}
                      className="form-control"
                      required={["name", "slug", "timezone"].includes(key)}
                      value={data[key] ?? ""}
                      type={
                        key === "contact_email" ? "email" : key === "website_url" ? "url" : "text"
                      }
                      maxLength={
                        key === "website_url"
                          ? 2048
                          : key === "country_code"
                            ? 2
                            : key === "timezone"
                              ? 64
                              : key === "contact_phone"
                                ? 30
                                : ["province", "city"].includes(key)
                                  ? 120
                                  : 255
                      }
                      onChange={(event) =>
                        setData((value) => ({
                          ...value,
                          [key]:
                            key === "country_code"
                              ? event.target.value.toUpperCase() || null
                              : event.target.value || null,
                        }))
                      }
                    />
                  )}
                </div>
              ))}
              <div className="col-12">
                <label className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={data.is_active}
                    onChange={(event) =>
                      setData((value) => ({ ...value, is_active: event.target.checked }))
                    }
                  />
                  <span className="form-check-label">{t("onboarding.active")}</span>
                </label>
              </div>
              <div className="col-12">
                <label className="form-label" htmlFor="hospital-reason">
                  {t("adminManage.reason")}
                </label>
                <textarea
                  id="hospital-reason"
                  className="form-control"
                  value={reason}
                  required
                  maxLength={1000}
                  onChange={(event) => setReason(event.target.value)}
                />
              </div>
            </div>
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
          <div className="d-flex flex-wrap align-items-center gap-2 mt-3">
            <button
              className="btn btn-primary"
              type="submit"
              disabled={write.busy || write.uncertain || !confirmed || !reason.trim()}
            >
              {t(write.busy ? "users.saving" : "users.save")}
            </button>
            <button
              className="btn btn-light"
              type="button"
              disabled={write.busy}
              onClick={onCancel}
            >
              {t("users.cancel")}
            </button>
            {write.uncertain && (
              <button
                className="btn btn-light"
                type="button"
                onClick={() => {
                  void clinicalRequest(
                    "GET",
                    path,
                    hospital ? hospitalDetail : createContext,
                    new AbortController().signal,
                  )
                    .then(() => {
                      write.refresh();
                      onRefresh();
                    })
                    .catch(() => {});
                }}
              >
                {t("adminReservations.refresh")}
              </button>
            )}
          </div>
        </form>
      )}
      <RecentPasswordDialog
        locale={normalizeProductLocale(i18n.resolvedLanguage)}
        onCancel={write.password.cancel}
        onSubmit={write.password.submit}
        request={write.password.request}
      />
    </>
  );
}
