import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardHeader, CardBody } from "reactstrap";
import { conflict, contentWrite, readContent } from "../../../modules/checkupino/content/api";
import {
  parseScheduleContext,
  parseScheduleResult,
} from "../../../modules/checkupino/content/schedules";
import { ConfirmContent, ContentDate, ContentState, useContent } from "./Shared";

export default function ArticleSchedule({
  id,
  disabled,
  onSaved,
  onUncertain,
}: {
  readonly id: string;
  readonly disabled: boolean;
  readonly onSaved: () => void;
  readonly onUncertain: () => void;
}) {
  const { t } = useTranslation();
  const path = `/api/admin/articles/${id}`;
  const result = useContent(path + "/schedule-context", { action: "arm" }, (wire) =>
    parseScheduleContext(wire, id, "arm"),
  );
  const [action, setAction] = useState<"arm" | "cancel" | null>(null);
  const context = result.data;
  const preference = context?.current.working.presentation?.publication;
  return (
    <Card data-article-schedule>
      <CardHeader>
        <h5 className="card-title mb-0">{t("content.schedule.heading")}</h5>
      </CardHeader>
      <CardBody>
        <ContentState busy={result.busy} error={result.error} />
        {context ? (
          <>
            <p className="text-muted">{t("content.schedule.preferenceHint")}</p>
            <p>
              <bdi>
                {preference
                  ? preference.local_time.replace("T", " ") + " — " + preference.timezone
                  : t("content.schedule.noPreference")}
              </bdi>
            </p>
            <output
              className={
                context.runner_available ? "d-block text-success mb-3" : "d-block text-warning mb-3"
              }
            >
              {t(
                context.runner_available
                  ? "content.schedule.runnerAvailable"
                  : "content.schedule.runnerUnavailable",
              )}
            </output>
            {context.schedule ? (
              <p>
                {t("content.schedule.state." + context.schedule.status)} ·{" "}
                {t("content.versionNumber", { version: context.schedule.version })}
                <span className="d-block">
                  <ContentDate value={context.schedule.publish_at} />
                </span>
                {context.schedule.blocker ? (
                  <span className="d-block text-warning">
                    {t("content.schedule.stoppedNotice")}
                  </span>
                ) : null}
              </p>
            ) : null}
            <p className="text-muted small">{t("content.schedule.rescheduleHint")}</p>
          </>
        ) : null}
        <div className="d-flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary"
            disabled={disabled || !context?.eligible || !!action || result.busy || result.error}
            onClick={() => setAction("arm")}
          >
            {t("content.schedule.arm")}
          </button>
          <button
            type="button"
            className="btn btn-light"
            disabled={
              disabled ||
              context?.schedule?.status !== "armed" ||
              !!action ||
              result.busy ||
              result.error
            }
            onClick={() => setAction("cancel")}
          >
            {t("content.schedule.cancel")}
          </button>
          <button
            type="button"
            className="btn btn-light"
            disabled={disabled || result.busy || !!action}
            onClick={result.refresh}
          >
            {t("adminReservations.refresh")}
          </button>
        </div>
        {action ? (
          <ScheduleConfirmation
            id={id}
            action={action}
            onClose={() => setAction(null)}
            onUncertain={() => {
              setAction(null);
              onUncertain();
            }}
            onSaved={() => {
              setAction(null);
              result.refresh();
              onSaved();
            }}
          />
        ) : null}
      </CardBody>
    </Card>
  );
}

function ScheduleConfirmation({
  id,
  action,
  onClose,
  onSaved,
  onUncertain,
}: {
  readonly id: string;
  readonly action: "arm" | "cancel";
  readonly onClose: () => void;
  readonly onSaved: () => void;
  readonly onUncertain: () => void;
}) {
  const { t } = useTranslation();
  const path = `/api/admin/articles/${id}`;
  const result = useContent(path + "/schedule-context", { action }, (wire) =>
    parseScheduleContext(wire, id, action),
  );
  const context = result.data;
  return (
    <ConfirmContent
      target={{
        title: t("content.schedule." + action),
        path: path + "/schedule-actions",
        method: "POST",
        body: {
          action,
          expected_revision: context?.revision ?? "",
          expected_version: context?.current.working.version ?? 0,
          expected_hash: context?.current.working.content_hash ?? "",
        },
        verify: async (signal) => {
          if (!context) throw conflict();
          const fresh = parseScheduleContext(
            await readContent(path + "/schedule-context", { action }, signal),
            id,
            action,
          );
          if (!fresh.eligible || fresh.revision !== context.revision) throw conflict();
        },
        write: async (target, method, body, signal) => {
          if (!context) throw conflict();
          const response = await contentWrite(target, method, body, signal);
          const schedule = parseScheduleResult(response.data, id);
          if (
            (context.schedule && context.schedule.id !== schedule.id) ||
            schedule.status !== (action === "arm" ? "armed" : "cancelled") ||
            (action === "arm" &&
              (schedule.version !== context.current.working.version ||
                schedule.content_hash !== context.current.working.content_hash))
          )
            throw new Error("Unexpected scheduling result; refresh required.");
          return response;
        },
      }}
      valid={!!context?.eligible && !result.busy && !result.error}
      onClose={onClose}
      onSaved={onSaved}
      onUncertain={onUncertain}
    >
      <ContentState busy={result.busy} error={result.error} />
      <p>{t("content.schedule.confirmNotice")}</p>
      {context ? (
        <p>
          {t("content.versionNumber", { version: context.current.working.version })}
          <br />
          <bdi>
            {context.current.working.presentation?.publication?.local_time.replace("T", " ")} —
            Asia/Tehran
          </bdi>
        </p>
      ) : null}
      {context?.blockers.length ? (
        <p role="alert" className="alert alert-warning">
          {t("content.schedule.blockedNotice")}
        </p>
      ) : null}
    </ConfirmContent>
  );
}
