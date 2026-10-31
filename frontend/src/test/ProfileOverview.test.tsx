import { render, screen, within } from "@testing-library/react";
import { createInstance } from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { describe, expect, it } from "vitest";
import en from "../locales/en.json";
import fa from "../locales/fa.json";
import { adaptPanelProfile } from "../modules/checkupino/profiles/contracts";
import ProfileOverview from "../pages/Users/ProfileOverview";

const publicId = "01m4hfgan168p6q5ftp528285f";
const fixture = () => ({
  user: {
    id: 4,
    public_id: publicId,
    name: "Synthetic Patient",
    first_name: "Synthetic",
    last_name: "Patient",
    role: "patient",
    account_state: "active",
    created_at: "2026-10-11T10:00:00Z",
    email: "PRIVATE@example.test",
    NID: "PRIVATE NID",
  },
  mode: "support",
  revision: "a".repeat(64),
  editable_fields: ["first_name", "last_name"],
  summary: {
    reservations: 1,
    upcoming: 0,
    completed: 1,
    medical_requests: 2,
    published_reports: 2,
    questionnaire_submissions: 1,
  },
  reservations: [
    {
      public_id: publicId,
      status: "completed",
      starts_at: "2026-10-11T04:30:00Z",
      ends_at: "2026-10-11T05:00:00Z",
      timezone: "Asia/Tehran",
      patient: "PRIVATE",
    },
  ],
  requests: [
    {
      public_id: publicId,
      status: "completed",
      created_at: null,
      closed_at: null,
      instructions: "PRIVATE CLINICAL",
    },
  ],
  reports: [
    {
      public_id: publicId,
      status: "published",
      published_at: null,
      is_amendment: false,
      body: "PRIVATE REPORT",
    },
  ],
  submissions: [
    {
      public_id: publicId,
      status: "submitted",
      created_at: null,
      result_body_html: "PRIVATE RESULT",
      total_score: 99,
      answers_json: ["PRIVATE ANSWER"],
    },
  ],
  activity: [
    {
      public_id: publicId,
      action: "reservation_file.uploaded",
      created_at: null,
      reason: "PRIVATE REASON",
      ip: "192.0.2.4",
    },
  ],
});

describe("shared owner/support profile foundation", () => {
  it("strips private and clinical fields at every wire boundary", () => {
    const profile = adaptPanelProfile({ data: fixture() });
    expect(JSON.stringify(profile)).not.toContain("PRIVATE");
    expect(profile.user).not.toHaveProperty("NID");
    expect(profile.reports[0]).not.toHaveProperty("body");
    expect(profile.submissions[0]).not.toHaveProperty("total_score");
    expect(profile.activity[0]).not.toHaveProperty("reason");
  });

  it.each(["password", "email", "NID", "body", "role"])(
    "rejects %s in server-issued editable fields",
    (field) => {
      expect(() =>
        adaptPanelProfile({ data: { ...fixture(), editable_fields: ["first_name", field] } }),
      ).toThrow(/Invalid input/);
    },
  );

  it("rejects drafts, unbounded previews and security-log actions", () => {
    const wire = fixture();
    expect(() =>
      adaptPanelProfile({ data: { ...wire, reports: [{ ...wire.reports[0], status: "draft" }] } }),
    ).toThrow(/Invalid input/);
    expect(() =>
      adaptPanelProfile({
        data: { ...wire, reports: Array.from({ length: 11 }, () => wire.reports[0]) },
      }),
    ).toThrow(/Too big/);
    expect(() =>
      adaptPanelProfile({
        data: { ...wire, activity: [{ ...wire.activity[0], action: "auth.login" }] },
      }),
    ).toThrow(/Invalid option/);
  });

  it.each(["en", "fa"] as const)(
    "renders the same metadata grid for self and support in %s",
    async (locale) => {
      const i18n = Object.assign(createInstance(), {
        reportNamespaces: { addUsedNamespaces: () => {}, getUsedNamespaces: () => [] },
      });
      await i18n.use(initReactI18next).init({
        lng: locale,
        keySeparator: false,
        interpolation: { escapeValue: false },
        resources: { en: { translation: en }, fa: { translation: fa } },
      });
      const profile = adaptPanelProfile({ data: fixture() });
      const { rerender } = render(
        <I18nextProvider i18n={i18n}>
          <ProfileOverview profile={profile} />
        </I18nextProvider>,
      );
      expect(screen.getByRole("heading", { name: "Synthetic Patient" })).toBeVisible();
      expect(screen.getAllByRole("region")).toHaveLength(6);
      expect(screen.queryByText(/PRIVATE/)).toBeNull();
      const reports = screen.getByRole("region", { name: i18n.t("profileOverview.reports") });
      expect(within(reports).getByText(i18n.t("profileOverview.status.published"))).toBeVisible();
      expect(within(reports).queryByRole("link")).toBeNull();
      const supportMarkup = reports.innerHTML;
      rerender(
        <I18nextProvider i18n={i18n}>
          <ProfileOverview profile={{ ...profile, mode: "self" }} />
        </I18nextProvider>,
      );
      expect(
        screen.getByRole("region", { name: i18n.t("profileOverview.reports") }).innerHTML,
      ).toBe(supportMarkup);
    },
  );
});
