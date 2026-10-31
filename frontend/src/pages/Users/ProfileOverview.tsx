import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardBody, Col, Row } from "reactstrap";
import type { PanelProfile } from "../../modules/checkupino/profiles/contracts";
import {
  formatProductNumber,
  formatProductTimestamp,
  normalizeProductLocale,
} from "../../modules/checkupino/preferences/localization";
import DetailBox from "../Administration/DetailBox";

/** Shared owner/support layout; the caller owns navigation and guarded inline editing. */
export default function ProfileOverview({
  profile,
  edit,
  quickAccess,
  reservationAction,
}: {
  readonly profile: PanelProfile;
  readonly edit?: ReactNode;
  readonly quickAccess?: ReactNode;
  readonly reservationAction?: (publicId: string) => ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const locale = normalizeProductLocale(i18n.resolvedLanguage);
  const date = (value: string | null) => (value ? formatProductTimestamp(value, locale) : "—");
  const rows = (
    items: readonly {
      readonly public_id: string;
      readonly status: string;
      readonly date: string | null;
    }[],
    appointment = false,
  ) =>
    items.length ? (
      <ul className="list-group list-group-flush">
        {items.map((item) => (
          <li key={item.public_id} className="list-group-item px-0">
            <div className="d-flex gap-2 justify-content-between flex-wrap">
              <span className="badge bg-primary-subtle text-primary">
                {t(`profileOverview.status.${item.status}`)}
              </span>
              <span className="text-muted small">{date(item.date)}</span>
            </div>
            <small className="text-muted text-break">
              <bdi>{item.public_id}</bdi>
            </small>
            {appointment && profile.mode === "self" ? reservationAction?.(item.public_id) : null}
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-muted mb-0">{t("profileOverview.empty")}</p>
    );

  return (
    <>
      <Row>
        <DetailBox
          id="profile-overview-identity"
          title={profile.user.name ?? t("profileOverview.title")}
          icon="ri-user-line"
          columns={12}
          actions={edit}
          fields={[
            [
              t("profileOverview.role"),
              profile.user.role
                ? t(
                    profile.user.role === "root-admin"
                      ? "product.role.rootAdmin"
                      : `users.role.${profile.user.role}`,
                  )
                : t("users.notAvailable"),
            ],
            [
              t("profileOverview.account"),
              profile.user.account_state
                ? t(`profileOverview.status.${profile.user.account_state}`)
                : t("users.notAvailable"),
            ],
            [t("profileOverview.joined"), date(profile.user.created_at)],
            [t("profileOverview.reference"), profile.user.public_id],
          ]}
        >
          <p className="text-muted mb-0">{t("profileOverview.privacy")}</p>
        </DetailBox>
      </Row>
      <Row>
        {Object.entries(profile.summary).map(([key, value]) => (
          <Col key={key} sm={6} xl={4}>
            <Card>
              <CardBody>
                <p className="text-muted mb-2">{t(`profileOverview.count.${key}`)}</p>
                <h3 className="mb-0">{formatProductNumber(value, locale)}</h3>
              </CardBody>
            </Card>
          </Col>
        ))}
      </Row>
      {quickAccess ? (
        <Row>
          <Col xs={12}>{quickAccess}</Col>
        </Row>
      ) : null}
      <Row>
        <DetailBox
          id="profile-overview-reservations"
          title={t("profileOverview.reservations")}
          icon="ri-calendar-line"
        >
          {rows(
            profile.reservations.map((item) => ({ ...item, date: item.starts_at })),
            true,
          )}
        </DetailBox>
        <DetailBox
          id="profile-overview-requests"
          title={t("profileOverview.requests")}
          icon="ri-folder-shield-2-line"
        >
          {rows(profile.requests.map((item) => ({ ...item, date: item.created_at })))}
        </DetailBox>
        <DetailBox
          id="profile-overview-reports"
          title={t("profileOverview.reports")}
          icon="ri-file-text-line"
        >
          {rows(profile.reports.map((item) => ({ ...item, date: item.published_at })))}
        </DetailBox>
        <DetailBox
          id="profile-overview-submissions"
          title={t("profileOverview.submissions")}
          icon="ri-survey-line"
        >
          {rows(profile.submissions.map((item) => ({ ...item, date: item.created_at })))}
        </DetailBox>
        <DetailBox
          id="profile-overview-activity"
          title={t("profileOverview.activity")}
          icon="ri-history-line"
          columns={12}
        >
          {profile.activity.length ? (
            <ul className="list-group list-group-flush">
              {profile.activity.map((item) => (
                <li
                  key={item.public_id}
                  className="list-group-item px-0 d-flex gap-2 justify-content-between flex-wrap"
                >
                  <span>{t(`profileOverview.action.${item.action}`)}</span>
                  <span className="text-muted">{date(item.created_at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted mb-0">{t("profileOverview.empty")}</p>
          )}
          <p className="text-muted small mt-3 mb-0">{t("profileOverview.previewBound")}</p>
        </DetailBox>
      </Row>
    </>
  );
}
