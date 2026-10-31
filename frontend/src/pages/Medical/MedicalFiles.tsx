import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { Button, Container } from "reactstrap";
import { medicalFileDownloadUrl } from "../../modules/checkupino/api/transport";

import {
  EmptyState,
  ErrorState,
  LoadingState,
  StatusBadge,
} from "../../modules/checkupino/feedback";
import {
  useDoctorMedicalDetailQuery,
  useDoctorMedicalRequestsQuery,
  usePatientMedicalOutcomeQuery,
  usePatientMedicalRequestsQuery,
} from "../../modules/checkupino/medical/api";
import type {
  DoctorMedicalDetail,
  MedicalReport,
  MedicalRequest,
} from "../../modules/checkupino/medical/types";
import {
  formatProductNumber,
  formatProductTimestamp,
  normalizeProductLocale,
} from "../../modules/checkupino/preferences/localization";
import "./medical.scss";
import { DoctorRequestModal } from "./DoctorRequestModal";
import { PatientUploadModal } from "./PatientUploadModal";
import { DoctorMedicalModal, type DoctorMedicalTarget } from "./DoctorMedicalModal";

const sameId = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();
const validProgress = (progress: MedicalRequest["upload_progress"]): boolean =>
  Boolean(
    progress &&
    Number.isSafeInteger(progress.received_count) &&
    progress.received_count >= 0 &&
    Number.isSafeInteger(progress.awaiting_checks_count) &&
    progress.awaiting_checks_count >= 0 &&
    progress.awaiting_checks_count <= progress.received_count,
  );

const MedicalReservation = ({
  doctor,
  reservationId,
}: {
  readonly doctor: boolean;
  readonly reservationId: string;
}) => {
  const { t, i18n } = useTranslation();
  const locale = normalizeProductLocale(i18n.resolvedLanguage);
  const [selection, setSelection] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestBlocked, setRequestBlocked] = useState(false);
  const [requestCreated, setRequestCreated] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<MedicalRequest | null>(null);
  const [uploadBlocked, setUploadBlocked] = useState<readonly string[]>([]);
  const [uploadReceived, setUploadReceived] = useState<string | null>(null);
  const [doctorTarget, setDoctorTarget] = useState<DoctorMedicalTarget | null>(null);
  const [doctorBlocked, setDoctorBlocked] = useState<readonly string[]>([]);
  const [doctorSaved, setDoctorSaved] = useState<string | null>(null);
  const patientList = usePatientMedicalRequestsQuery(reservationId, {
    skip: doctor || !reservationId,
    refetchOnMountOrArgChange: true,
  });
  const doctorList = useDoctorMedicalRequestsQuery(reservationId, {
    skip: !doctor || !reservationId,
    refetchOnMountOrArgChange: true,
  });
  const list = doctor ? doctorList : patientList;
  // Hide retained data during refresh/errors and never reuse another reservation's result.
  const listMismatch = list.currentData?.some(
    (item) => !sameId(item.reservation_public_id, reservationId),
  );
  const requests = !list.isFetching && !list.error && !listMismatch ? list.currentData : undefined;
  const selected = requests?.find((item) => item.public_id === selection) ?? requests?.[0];
  const rules = selected?.attachment_rules;
  const scope = { reservationId, requestId: selected?.public_id ?? "" };
  const detailQuery = useDoctorMedicalDetailQuery(scope, {
    skip: !doctor || !selected,
    refetchOnMountOrArgChange: true,
  });
  const outcomeQuery = usePatientMedicalOutcomeQuery(scope, {
    skip: doctor || selected?.status !== "completed",
    refetchOnMountOrArgChange: true,
  });
  const query = doctor ? detailQuery : outcomeQuery;
  const result = !query.isFetching && !query.error ? query.currentData : undefined;
  const matchingResult =
    result &&
    selected &&
    sameId(result.medical_request.public_id, selected.public_id) &&
    sameId(result.medical_request.reservation_public_id, reservationId);
  const doctorDetail = doctor && matchingResult ? detailQuery.currentData : undefined;
  const patientOutcome = !doctor && matchingResult ? outcomeQuery.currentData : undefined;
  const reportMatches = (report: MedicalReport) =>
    selected &&
    sameId(report.medical_request_public_id, selected.public_id) &&
    report.body_format === "plain_text";
  const invalidOutcome =
    patientOutcome &&
    (patientOutcome.medical_request.status !== "completed" ||
      patientOutcome.latest_report.status !== "published" ||
      !patientOutcome.latest_report.published_at ||
      !reportMatches(patientOutcome.latest_report) ||
      patientOutcome.report_history.length === 0 ||
      patientOutcome.report_history.some(
        (report) => report.status !== "published" || !report.published_at || !reportMatches(report),
      ) ||
      !patientOutcome.report_history.some((report) =>
        sameId(report.public_id, patientOutcome.latest_report.public_id),
      ));
  const invalidDetail = doctorDetail?.reports.some((report) => !reportMatches(report));
  const invalidResult = (result && !matchingResult) || invalidOutcome || invalidDetail;
  const files = !invalidResult
    ? (doctorDetail?.files ?? patientOutcome?.files)?.filter((file) => file.available)
    : undefined;
  const reports = !invalidResult
    ? (doctorDetail?.reports ?? patientOutcome?.report_history)
    : undefined;
  const title = t("medical.title");
  const listPath = doctor ? "/doctor/reservations" : "/my/reservations";
  const matchingDoctorDetail = (detail: DoctorMedicalDetail, requestId: string) =>
    sameId(detail.medical_request.public_id, requestId) &&
    sameId(detail.medical_request.reservation_public_id, reservationId) &&
    detail.reports.every(
      (report) =>
        sameId(report.medical_request_public_id, requestId) && report.body_format === "plain_text",
    );
  useEffect(() => {
    document.title = title;
  }, [title]);
  const refreshRequests = async () => {
    try {
      // Start both reads before list refresh can unsubscribe the selected detail.
      const [refreshed, freshDetail] = await Promise.all([
        list.refetch().unwrap(),
        doctor && selected ? detailQuery.refetch().unwrap() : Promise.resolve(undefined),
      ]);
      if (refreshed.every((item) => sameId(item.reservation_public_id, reservationId))) {
        setRequestBlocked(false);
        setUploadBlocked((ids) =>
          ids.filter(
            (id) =>
              !refreshed.some(
                (item) => sameId(item.public_id, id) && validProgress(item.upload_progress),
              ),
          ),
        );
        if (doctor && selected && freshDetail) {
          if (matchingDoctorDetail(freshDetail, selected.public_id)) {
            setDoctorBlocked((ids) => ids.filter((id) => !sameId(id, selected.public_id)));
          }
        }
      }
    } catch {
      // The list displays the error; a failed check keeps writes blocked.
    }
  };

  return (
    <div className="page-content">
      <Container fluid>
        <div className="page-title-box d-sm-flex align-items-center justify-content-between">
          <h4 className="mb-sm-0">{title}</h4>
          <ol className="breadcrumb m-0">
            <li className="breadcrumb-item">
              <Link to={listPath}>
                {t(doctor ? "booking.doctorReservations" : "booking.myReservations")}
              </Link>
            </li>
            <li className="breadcrumb-item active" aria-current="page">
              {title}
            </li>
          </ol>
        </div>
        {!reservationId || listMismatch ? (
          <div className="alert alert-danger" role="alert">
            {t("medical.unavailable")}
          </div>
        ) : null}
        {list.isFetching && <LoadingState locale={locale} />}
        {list.error && (
          <ErrorState error={list.error} locale={locale} onRetry={() => void refreshRequests()} />
        )}
        {doctor && requestCreated && requests && (
          <output className="alert alert-success d-block" aria-live="polite">
            {t("medical.requestCreated")}
          </output>
        )}
        {requests?.length === 0 && (
          <EmptyState
            locale={locale}
            description={t("medical.noRequests")}
            action={
              doctor ? (
                <div className="d-flex justify-content-center gap-2">
                  <Button color="success" onClick={() => setRequestOpen(true)}>
                    {t("medical.newRequest")}
                  </Button>
                  <Button color="light" onClick={() => void refreshRequests()}>
                    {t("medical.refresh")}
                  </Button>
                </div>
              ) : undefined
            }
          />
        )}
        {requests && selected && (
          <div
            className={`chat-wrapper position-relative overflow-hidden d-lg-flex gap-1 p-1${reportsOpen && reports?.length ? " file-detail-show" : ""}`}
          >
            <aside
              className={`file-manager-sidebar${menuOpen ? " menubar-show" : ""}`}
              aria-label={t("medical.requests")}
            >
              <div className="p-3 d-flex flex-column h-100">
                <div className="d-flex align-items-center mb-3">
                  <h5 className="mb-0 fw-semibold flex-grow-1">{t("medical.requests")}</h5>
                  <Button
                    className="btn-icon d-lg-none"
                    color="light"
                    aria-label={t("medical.close")}
                    onClick={() => setMenuOpen(false)}
                  >
                    <i className="ri-close-line" aria-hidden="true" />
                  </Button>
                </div>
                <div className="file-menu-sidebar-scroll overflow-auto">
                  <ul className="list-unstyled file-manager-menu">
                    {requests.map((item) => (
                      <li key={item.public_id}>
                        <Button
                          color="link"
                          className={`p-0 text-start ${item.public_id === selected.public_id ? "text-success" : "text-body"}`}
                          aria-pressed={item.public_id === selected.public_id}
                          onClick={() => {
                            setSelection(item.public_id);
                            setMenuOpen(false);
                            setReportsOpen(false);
                          }}
                        >
                          <i className="ri-folder-2-line align-bottom me-2" aria-hidden="true" />
                          <span>{item.title}</span>
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </aside>
            <div className="file-manager-content w-100 overflow-hidden p-3 py-0">
              <div className="pt-4 px-4 file-manager-content-scroll overflow-x-hidden overflow-y-auto">
                <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
                  <Button
                    color="soft-success"
                    className="btn-icon btn-sm d-lg-none"
                    aria-label={t("medical.requests")}
                    aria-expanded={menuOpen}
                    onClick={() => setMenuOpen(!menuOpen)}
                  >
                    <i className="ri-menu-2-fill" aria-hidden="true" />
                  </Button>
                  <h5 className="fs-16 mb-0 flex-grow-1">{selected.title}</h5>
                  {doctor && (
                    <Button color="success" size="sm" onClick={() => setRequestOpen(true)}>
                      {t("medical.newRequest")}
                    </Button>
                  )}
                  {doctor &&
                    doctorDetail &&
                    !invalidResult &&
                    selected.status === "open" &&
                    Boolean(files?.length) && (
                      <Button
                        color="success"
                        size="sm"
                        onClick={() => setDoctorTarget({ kind: "review", detail: doctorDetail })}
                      >
                        {t("medical.startReview")}
                      </Button>
                    )}
                  {doctor &&
                    doctorDetail &&
                    !invalidResult &&
                    selected.status === "in_review" &&
                    !doctorDetail.reports.some(
                      (report) => report.supersedes_report_public_id === null,
                    ) && (
                      <Button
                        color="success"
                        size="sm"
                        onClick={() => setDoctorTarget({ kind: "draft", detail: doctorDetail })}
                      >
                        {t("medical.newDraft")}
                      </Button>
                    )}
                  <Button
                    color="light"
                    size="sm"
                    onClick={() => {
                      setReportsOpen(false);
                      void refreshRequests();
                    }}
                  >
                    {t("medical.refresh")}
                  </Button>
                  {!doctor && selected.status === "open" && rules?.state === "available" && (
                    <Button color="success" size="sm" onClick={() => setUploadTarget(selected)}>
                      {t("medical.uploadFile")}
                    </Button>
                  )}
                </div>
                <StatusBadge
                  label={t(`medical.state.${selected.status}`)}
                  tone={selected.status === "completed" ? "success" : "neutral"}
                />
                {selected.instructions && (
                  <p className="text-break mt-3">{selected.instructions}</p>
                )}
                {selected.due_at && (
                  <p>
                    {t("medical.due")}: {formatProductTimestamp(selected.due_at, locale)}
                  </p>
                )}
                <h6 className="mt-4">{t("medical.attachmentRules")}</h6>
                {rules?.state === "available" ? (
                  <ul
                    className="list-unstyled d-flex flex-column gap-2 text-start"
                    dir={locale === "fa" ? "rtl" : "ltr"}
                  >
                    {rules.allowed_mime_types.map((mime) => (
                      <li key={mime} className="border rounded p-2">
                        <bdi dir="ltr" className="badge bg-info-subtle text-info mb-1">
                          {mime}
                        </bdi>
                        <span className="d-block small">
                          {formatProductNumber(rules.max_bytes_by_mime[mime], locale)}{" "}
                          {t("medical.bytesPerFile")}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="alert alert-warning">{t("medical.policyUnavailable")}</p>
                )}
                {!doctor && selected.status !== "completed" && (
                  <p className="alert alert-info">{t("medical.outcomePending")}</p>
                )}
                {!doctor && sameId(uploadReceived ?? "", selected.public_id) && (
                  <output className="alert alert-info d-block" aria-live="polite">
                    {t("medical.uploadReceived")}
                  </output>
                )}
                {doctor && sameId(doctorSaved ?? "", selected.public_id) && (
                  <output className="alert alert-success d-block" aria-live="polite">
                    {t("medical.actionSaved")}
                  </output>
                )}
                {!doctor && validProgress(selected.upload_progress) && selected.upload_progress && (
                  <output className="alert alert-info d-block" aria-live="polite">
                    <span className="d-block mb-1">
                      {t("medical.receivedCount", {
                        amount: formatProductNumber(
                          selected.upload_progress.received_count,
                          locale,
                        ),
                      })}
                    </span>
                    {selected.upload_progress.awaiting_checks_count > 0 && (
                      <span className="d-block mb-1">
                        {t("medical.awaitingChecksCount", {
                          amount: formatProductNumber(
                            selected.upload_progress.awaiting_checks_count,
                            locale,
                          ),
                        })}
                      </span>
                    )}
                    <span className="d-block">{t("medical.uploadCheckingNote")}</span>
                  </output>
                )}
                {query.isFetching && <LoadingState locale={locale} />}
                {query.error && (
                  <ErrorState
                    error={query.error}
                    locale={locale}
                    onRetry={() => void query.refetch()}
                  />
                )}
                {invalidResult && (
                  <div className="alert alert-danger" role="alert">
                    {t("medical.unavailable")}
                  </div>
                )}
                {files && (
                  <>
                    <div className="d-flex flex-wrap align-items-center mb-3 mt-4">
                      <h5 className="flex-grow-1 fs-16 mb-0">{t("medical.eligibleFiles")}</h5>
                      {reports && reports.length > 0 && (
                        <Button color="success" size="sm" onClick={() => setReportsOpen(true)}>
                          {t("medical.reports")}
                        </Button>
                      )}
                    </div>
                    {files.length === 0 ? (
                      <EmptyState locale={locale} description={t("medical.noEligibleFiles")} />
                    ) : (
                      <div className="table-responsive">
                        <table className="table align-middle table-nowrap mb-0">
                          <thead className="table-active">
                            <tr>
                              {["name", "type", "size", "created", "availability", "actions"].map(
                                (key) => (
                                  <th key={key} scope="col">
                                    {t(`medical.${key}`)}
                                  </th>
                                ),
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {files.map((file) => (
                              <tr key={file.public_id}>
                                <td aria-label={file.label ?? t("medical.unnamedFile")}>
                                  <div className="d-flex align-items-center">
                                    <i
                                      className="ri-file-list-2-line fs-17 me-2"
                                      aria-hidden="true"
                                    />
                                    <span>{file.label ?? t("medical.unnamedFile")}</span>
                                  </div>
                                </td>
                                <td>{file.mime_type}</td>
                                <td>
                                  {formatProductNumber(file.size_bytes, locale)}{" "}
                                  {t("medical.bytes")}
                                </td>
                                <td>
                                  {file.created_at
                                    ? formatProductTimestamp(file.created_at, locale)
                                    : "—"}
                                </td>
                                <td>{t("medical.available")}</td>
                                <td>
                                  <a
                                    className="btn btn-light btn-sm"
                                    target="_blank"
                                    rel="noopener"
                                    referrerPolicy="origin"
                                    href={medicalFileDownloadUrl({
                                      reservationId,
                                      requestId: selected.public_id,
                                      fileId: file.public_id,
                                      doctor,
                                    })}
                                  >
                                    {t("medical.download")}
                                  </a>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            {reportsOpen && reports && reports.length > 0 && (
              <aside className="file-manager-detail-content p-3" aria-label={t("medical.reports")}>
                <div className="d-flex align-items-center mb-3">
                  <h5 className="flex-grow-1 fs-16 mb-0">{t("medical.reports")}</h5>
                  <Button
                    color="light"
                    className="btn-icon"
                    aria-label={t("medical.close")}
                    onClick={() => setReportsOpen(false)}
                  >
                    <i className="ri-close-line" aria-hidden="true" />
                  </Button>
                </div>
                <div className="file-detail-content-scroll overflow-auto">
                  {reports.map((report) => (
                    <section className="card" key={report.public_id}>
                      <div className="card-body">
                        <StatusBadge
                          label={t(`medical.reportState.${report.status}`)}
                          tone={report.status === "published" ? "success" : "neutral"}
                        />
                        {report.author_name && (
                          <p className="mt-2 mb-1">
                            {t("medical.author")}: {report.author_name}
                          </p>
                        )}
                        {report.published_at && (
                          <p className="text-muted">
                            {formatProductTimestamp(report.published_at, locale)}
                          </p>
                        )}
                        <pre dir="auto" className="text-break mb-0">
                          {report.body}
                        </pre>
                        {doctor && doctorDetail && (
                          <div className="d-flex gap-2 mt-3">
                            {report.status === "draft" ? (
                              <>
                                <Button
                                  color="light"
                                  size="sm"
                                  onClick={() =>
                                    setDoctorTarget({ kind: "edit", detail: doctorDetail, report })
                                  }
                                >
                                  {t("medical.editDraft")}
                                </Button>
                                <Button
                                  color="success"
                                  size="sm"
                                  onClick={() =>
                                    setDoctorTarget({
                                      kind: "publish",
                                      detail: doctorDetail,
                                      report,
                                    })
                                  }
                                >
                                  {t("medical.publishReport")}
                                </Button>
                              </>
                            ) : (
                              selected.status === "completed" &&
                              !reports.some(
                                (item) => item.supersedes_report_public_id === report.public_id,
                              ) && (
                                <Button
                                  color="light"
                                  size="sm"
                                  onClick={() =>
                                    setDoctorTarget({ kind: "amend", detail: doctorDetail, report })
                                  }
                                >
                                  {t("medical.amendReport")}
                                </Button>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    </section>
                  ))}
                </div>
              </aside>
            )}
          </div>
        )}
        {doctor && requestOpen && (
          <DoctorRequestModal
            reservationId={reservationId}
            isOpen={requestOpen}
            blocked={requestBlocked}
            checkRequests={() => doctorList.refetch().unwrap()}
            onClose={() => setRequestOpen(false)}
            onUncertain={() => setRequestBlocked(true)}
            onCreated={(request) => {
              setSelection(request.public_id);
              setReportsOpen(false);
              setRequestCreated(true);
              setRequestOpen(false);
            }}
          />
        )}
        {!doctor && uploadTarget && (
          <PatientUploadModal
            key={uploadTarget.public_id}
            reservationId={reservationId}
            medicalRequest={uploadTarget}
            blocked={uploadBlocked.some((id) => sameId(id, uploadTarget.public_id))}
            checkRequests={() => patientList.refetch().unwrap()}
            onClose={() => setUploadTarget(null)}
            onUncertain={(id) => setUploadBlocked((ids) => [...new Set([...ids, id])])}
            onReceived={(id) => {
              setUploadReceived(id);
              setUploadTarget(null);
            }}
          />
        )}
        {doctor && doctorTarget && (
          <DoctorMedicalModal
            key={`${doctorTarget.kind}:${doctorTarget.detail.medical_request.public_id}:${doctorTarget.report?.public_id ?? ""}`}
            reservationId={reservationId}
            target={doctorTarget}
            blocked={doctorBlocked.some((id) =>
              sameId(id, doctorTarget.detail.medical_request.public_id),
            )}
            checkDetail={() => detailQuery.refetch().unwrap()}
            onClose={() => setDoctorTarget(null)}
            onUncertain={(id) => setDoctorBlocked((ids) => [...new Set([...ids, id])])}
            onSaved={(id) => {
              setDoctorSaved(id);
              setDoctorTarget(null);
              setReportsOpen(true);
            }}
          />
        )}
      </Container>
    </div>
  );
};

const MedicalFiles = ({ doctor = false }: { readonly doctor?: boolean }) => {
  const { reservationId = "" } = useParams<{ reservationId: string }>();
  // A route change remounts selection and overlay state, even when the lazy page is reused.
  return (
    <MedicalReservation
      key={`${doctor}:${reservationId}`}
      doctor={doctor}
      reservationId={reservationId}
    />
  );
};
export const DoctorMedicalFiles = () => <MedicalFiles doctor />;
export default MedicalFiles;
