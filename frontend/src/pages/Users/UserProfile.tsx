import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Card, CardBody, CardHeader, Container } from "reactstrap";
import BreadCrumb from "../../Components/Common/BreadCrumb";
import { useShellAuth } from "../../Layouts/ShellAuthContext";
import { adminAuthAuthority } from "../../modules/checkupino/auth/authority";
import { parseServerTableQuery, serializeServerTableQuery } from "../../modules/checkupino/table";
import {
  createUserDirectoryAdapter,
  scopedDirectoryQuery,
} from "../../modules/checkupino/users/directory";
import { usePanelProfileQuery, validProfileId } from "../../modules/checkupino/profiles/api";
import ProfileNameForm from "./ProfileNameForm";
import ProfileOverview from "./ProfileOverview";
import DoctorPractice from "./DoctorPractice";
import PatientHealth from "./PatientHealth";

function ProfileSession({
  support,
  target,
  valid,
}: {
  readonly support: boolean;
  readonly target: string | null;
  readonly valid: boolean;
}) {
  const { capabilities, userProfile } = useShellAuth();
  const { t } = useTranslation();
  const [search] = useSearchParams();
  const directory = support ? search.get("directory") : null;
  const scope =
    directory === "doctors" ? "doctor" : directory === "patients" ? "patient" : undefined;
  const adapter = useMemo(
    () => createUserDirectoryAdapter(capabilities.manageAdminIdentities, scope),
    [capabilities.manageAdminIdentities, scope],
  );
  const back = serializeServerTableQuery(
    scopedDirectoryQuery(parseServerTableQuery(search, adapter), scope),
    adapter,
  ).toString();
  const allowed = support ? capabilities.manageMarketplaceUsers : !!userProfile;
  const [editing, setEditing] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [saved, setSaved] = useState(false);
  const { currentData, error, isFetching, refetch } = usePanelProfileQuery(target, {
    skip: !allowed || !valid,
    refetchOnMountOrArgChange: true,
  });
  const row =
    !error && !isFetching && (support || currentData?.user.id === userProfile?.id)
      ? currentData
      : undefined;
  const backScope =
    scope ??
    (row?.user.role === "doctor" || row?.user.role === "patient" ? row.user.role : undefined);
  const backPath = backScope ? backScope + "s" : capabilities.manageAdminIdentities ? "users" : "";
  const refresh = () => {
    setEditing(false);
    setSaved(false);
    void refetch().then((result) => {
      if (!result.error) setUncertain(false);
    });
  };
  if (!allowed) return <p role="alert">{t("users.accessDenied")}</p>;
  return (
    <div className="page-content">
      <Container fluid>
        <BreadCrumb
          title={t("profileOverview.title")}
          pageTitle={t(support ? "users.directory" : "profileOverview.title")}
        />
        <Card>
          <CardHeader className="d-flex gap-2 flex-wrap align-items-center">
            <h5 className="card-title flex-grow-1 mb-0">
              {t(support ? "profileOverview.support" : "profileOverview.title")}
            </h5>
            {support ? (
              <Link className="btn btn-light" to={`/${backPath}?${back}`}>
                {t("adminManage.back")}
              </Link>
            ) : null}
            <button
              className="btn btn-light"
              disabled={!valid || isFetching || editing}
              onClick={refresh}
            >
              {t("adminReservations.refresh")}
            </button>
          </CardHeader>
          <CardBody>
            {!valid ||
            error ||
            (!support && currentData && currentData.user.id !== userProfile?.id) ? (
              <p role="alert" className="alert alert-warning">
                {t("profileOverview.unavailable")}
              </p>
            ) : null}
            {isFetching ? (
              <output className="d-block">{t("adminReservations.loading")}</output>
            ) : null}
            {saved ? (
              <output className="alert alert-success d-block">{t("users.saved")}</output>
            ) : null}
            {uncertain ? (
              <p role="alert" className="alert alert-warning">
                {t("profileOverview.refreshRequired")}
              </p>
            ) : null}
            {row ? (
              <ProfileOverview
                profile={row}
                edit={
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={editing || uncertain}
                    onClick={() => {
                      setEditing(true);
                      setSaved(false);
                    }}
                  >
                    {t("profileOverview.editName")}
                  </button>
                }
                reservationAction={
                  !support && (row.user.role === "patient" || row.user.role === "doctor")
                    ? (reservationId) => (
                        <Link
                          className="btn btn-sm btn-light d-block mt-2"
                          to={`/${row.user.role === "doctor" ? "doctor" : "my"}/reservations/${reservationId}/medical`}
                        >
                          {t("medical.title")}
                        </Link>
                      )
                    : undefined
                }
                quickAccess={
                  <Card>
                    <CardBody className="d-flex gap-2 flex-wrap">
                      {support && row.user.role === "patient" ? (
                        <Link
                          className="btn btn-soft-primary"
                          to={`/reservations?user_id=${row.user.id}`}
                        >
                          {t("profileOverview.allAppointments")}
                        </Link>
                      ) : null}
                      {support && row.user.role === "doctor" && row.user.doctor_profile_id ? (
                        <Link
                          className="btn btn-soft-primary"
                          to={`/reservations?doctor_id=${row.user.doctor_profile_id}`}
                        >
                          {t("profileOverview.allAppointments")}
                        </Link>
                      ) : null}
                      {!support && row.user.role === "patient" ? (
                        <>
                          <Link className="btn btn-soft-primary" to="/my/reservations">
                            {t("booking.myReservations")}
                          </Link>
                          <Link className="btn btn-light" to="/my/questionnaire">
                            {t("questionnaire.title")}
                          </Link>
                          <a className="btn btn-soft-info" href="#patient-health">
                            {t("health.title")}
                          </a>
                        </>
                      ) : null}
                      {!support && row.user.role === "doctor" ? (
                        <>
                          <a className="btn btn-soft-info" href="#doctor-practice">
                            {t("doctorPractice.title")}
                          </a>
                          <Link className="btn btn-soft-primary" to="/doctor/reservations">
                            {t("booking.doctorReservations")}
                          </Link>
                        </>
                      ) : null}
                      <a className="btn btn-light" href="#profile-overview-reports">
                        {t("profileOverview.reports")}
                      </a>
                      <a className="btn btn-light" href="#profile-overview-activity">
                        {t("profileOverview.activity")}
                      </a>
                    </CardBody>
                  </Card>
                }
              />
            ) : null}
            {row && editing ? (
              <ProfileNameForm
                key={`${target ?? "self"}:${row.revision}`}
                profile={row}
                target={target}
                onClose={() => setEditing(false)}
                onUncertain={() => setUncertain(true)}
                onSaved={() => {
                  setEditing(false);
                  setSaved(true);
                  void refetch();
                  if (row.user.id === userProfile?.id) void adminAuthAuthority.bootstrap(true);
                }}
              />
            ) : null}
          </CardBody>
        </Card>
        {!support && row?.user.role === "doctor" && <DoctorPractice ownerId={row.user.id} />}
        {!support && row?.user.role === "patient" && userProfile?.roles.length === 1 && (
          <PatientHealth key={row.user.public_id} ownerId={row.user.public_id} />
        )}
      </Container>
    </div>
  );
}
export default function UserProfile({ support = false }: { readonly support?: boolean }) {
  const { userId = "" } = useParams();
  const { userProfile } = useShellAuth();
  const target = support ? userId.toLowerCase() : null;
  return (
    <ProfileSession
      key={`${target ?? "self"}:${userProfile?.id ?? "guest"}:${userProfile?.roles.join("|") ?? ""}`}
      support={support}
      target={target}
      valid={!support || validProfileId(userId)}
    />
  );
}
export function SupportProfile() {
  return <UserProfile support />;
}
