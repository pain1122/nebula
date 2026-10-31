import { render, screen } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import type { RoleName } from "../types/auth";
import RouteIndex from "./index";
import { authProtectedRoutes, publicRoutes } from "./allRoutes";
import type { AppRoute } from "./routeTypes";

const { authState } = vi.hoisted(() => ({
  authState: { profile: null as { roles: RoleName[] } | null },
}));

vi.mock("../Components/Hooks/UserHooks", () => ({
  useProfile: () => ({ loading: false, userProfile: authState.profile }),
}));

vi.mock("../Layouts/NonAuthLayout", () => ({
  default: ({ children }: PropsWithChildren) => <>{children}</>,
}));

vi.mock("../Layouts/index", () => ({
  default: ({ children }: PropsWithChildren) => <>{children}</>,
}));

vi.mock("../pages/Authentication/Login", () => ({
  default: () => <p>canonical login</p>,
}));

vi.mock("../pages/DashboardEcommerce", () => ({
  default: () => <p>canonical admin home</p>,
}));
vi.mock("../pages/DashboardEcommerce/ProductDashboard", () => ({
  default: () => <p>canonical admin home</p>,
}));
vi.mock("../pages/Administration/Schedules", () => ({
  default: () => <p>schedule workplaces</p>,
  WorkplaceSchedule: () => <p>workplace schedule detail</p>,
}));
vi.mock("../pages/Administration/Payments", () => ({
  default: () => <p>payment list</p>,
  PaymentDetail: () => <p>payment details</p>,
}));
vi.mock("../pages/Administration/Activity", () => ({ default: () => <p>authorized activity</p> }));
vi.mock("../pages/Administration/Catalog", () => ({
  default: () => <p>catalog checkups</p>,
  Categories: () => <p>catalog categories</p>,
  Specialties: () => <p>catalog specialties</p>,
}));
vi.mock("../pages/Administration/CatalogDetail", () => ({
  default: () => <p>catalog checkup details</p>,
  CategoryDetail: () => <p>catalog category details</p>,
  SpecialtyDetail: () => <p>catalog specialty details</p>,
}));

vi.mock("../pages/Users/UserDirectory", () => ({
  default: () => <p>marketplace users</p>,
}));
vi.mock("../pages/Users/UserProfile", () => ({
  default: () => <p>owner profile</p>,
  SupportProfile: () => <p>support profile</p>,
}));
vi.mock("../pages/Reservations/AdminReservations", () => ({
  default: () => <p>admin reservation list</p>,
}));
vi.mock("../pages/Reservations/AdminReservationDetail", () => ({
  default: () => <p>admin reservation detail</p>,
}));
vi.mock("../pages/Uploads/UploadLimits", () => ({ default: () => <p>root upload limits</p> }));
vi.mock("../pages/Administration/GeneralSettings", () => ({
  default: () => <p>root general settings</p>,
}));
vi.mock("../pages/Booking/PatientBooking", () => ({ default: () => <p>patient booking</p> }));
vi.mock("../pages/Booking/PatientReservations", () => ({
  default: () => <p>patient reservations</p>,
}));
vi.mock("../pages/Booking/DoctorReservations", () => ({
  default: () => <p>doctor reservations</p>,
}));
vi.mock("../pages/Questionnaire/QuestionnaireWorkspace", () => ({
  default: () => <p>patient questionnaire</p>,
}));
vi.mock("../pages/Medical/MedicalFiles", () => ({
  default: () => <p>patient medical files</p>,
  DoctorMedicalFiles: () => <p>doctor medical files</p>,
}));

vi.mock("../devtools/ToolboxRouter", () => ({
  default: () => <p>root toolbox</p>,
}));

const renderPath = (path: string, roles: RoleName[] | null) => {
  authState.profile = roles ? { roles } : null;

  return render(
    <MemoryRouter basename="/panel" initialEntries={[path]}>
      <RouteIndex />
    </MemoryRouter>,
  );
};

describe("canonical /panel router contract", () => {
  it("registers relative login, home, users, toolbox, and fallback paths", () => {
    expect(publicRoutes.map((route) => route.path)).toEqual(["login"]);
    expect(authProtectedRoutes.map((route) => route.path)).toEqual([
      "articles",
      "articles/new",
      "articles/:articleId",
      "article-taxonomies",
      "medical-requests",
      "medical-requests/:requestId",
      "questionnaires",
      "questionnaires/:questionnaireId",
      "questionnaire-submissions",
      "questionnaire-submissions/:submissionId",
      "doctors",
      "patients",
      "doctors/new",
      "patients/new",
      "hospitals",
      "hospitals/new",
      "hospitals/:hospitalId",
      "schedules/workplaces",
      "activity",
      "schedules",
      "payments",
      "payments/:paymentId",
      "schedules/workplaces/:workplaceId",
      "specialties",
      "specialties/:specialtyId",
      "checkups",
      "checkups/:checkupId",
      "checkup-categories",
      "checkup-categories/:categoryId",
      "",
      "users",
      "profile",
      "users/:userId",
      "reservations",
      "reservations/:reservationId",
      "upload-limits",
      "settings/general",
      "book",
      "my/reservations",
      "my/questionnaire",
      "doctor/reservations",
      "my/reservations/:reservationId/medical",
      "doctor/reservations/:reservationId/medical",
      "dev/*",
      "*",
    ]);
    const routes: AppRoute[] = [...publicRoutes, ...authProtectedRoutes];
    expect(routes.every((route) => !route.path.startsWith("/panel"))).toBe(true);
  });

  it("routes a guest at the canonical admin root to the canonical login", async () => {
    renderPath("/panel", null);
    expect(await screen.findByText("canonical login")).toBeInTheDocument();
  });

  it.each([
    ["patient", "patient questionnaire"],
    [null, "canonical login"],
    ["doctor", "canonical admin home"],
    ["admin", "canonical admin home"],
    ["root-admin", "canonical admin home"],
  ] as const)(
    "keeps the approved questionnaire deep link patient-only for %s",
    async (role, landing) => {
      renderPath("/panel/my/questionnaire", role ? [role] : null);
      expect(await screen.findByText(landing)).toBeInTheDocument();
      if (role !== "patient")
        expect(screen.queryByText("patient questionnaire")).not.toBeInTheDocument();
    },
  );

  it.each([
    ["my", "patient", "patient medical files"],
    ["doctor", "doctor", "doctor medical files"],
  ] as const)(
    "allows the %s medical deep link to refresh for %s",
    async (prefix, role, content) => {
      renderPath(`/panel/${prefix}/reservations/R1/medical`, [role]);
      expect(await screen.findByText(content)).toBeInTheDocument();
    },
  );

  it.each([
    ["my", null, "canonical login"],
    ["doctor", null, "canonical login"],
    ["my", "doctor", "canonical admin home"],
    ["doctor", "patient", "canonical admin home"],
    ["my", "admin", "canonical admin home"],
    ["doctor", "root-admin", "canonical admin home"],
  ] as const)("denies the %s medical deep link to %s", async (prefix, role, landing) => {
    renderPath(`/panel/${prefix}/reservations/R1/medical`, role ? [role] : null);
    expect(await screen.findByText(landing)).toBeInTheDocument();
    expect(screen.queryByText("patient medical files")).not.toBeInTheDocument();
    expect(screen.queryByText("doctor medical files")).not.toBeInTheDocument();
  });

  it("renders the canonical admin home without a duplicated basename", async () => {
    renderPath("/panel", ["admin"]);
    expect(await screen.findByText("canonical admin home")).toBeInTheDocument();
  });

  it.each(["root-admin"] as const)("allows %s to refresh the users deep link", async (role) => {
    renderPath("/panel/users", [role]);
    expect(await screen.findByText("marketplace users")).toBeInTheDocument();
  });

  it.each([null, ["admin"], ["doctor"], ["patient"]] as const)(
    "denies the directory to non-admin identity %j",
    async (roles) => {
      renderPath("/panel/users", roles ? [...roles] : null);
      const roleNames: readonly RoleName[] = roles ?? [];
      const landing = roleNames.includes("doctor")
        ? "canonical admin home"
        : roleNames.includes("patient")
          ? "canonical admin home"
          : roleNames.includes("admin")
            ? "canonical admin home"
            : "canonical login";
      expect(await screen.findByText(landing)).toBeInTheDocument();
      expect(screen.queryByText("marketplace users")).not.toBeInTheDocument();
    },
  );

  it("keeps toolbox rendering root-only under the basename", async () => {
    const rendered = renderPath("/panel/dev/pages-starter", ["admin"]);
    expect(await screen.findByText("canonical admin home")).toBeInTheDocument();

    rendered.unmount();
    renderPath("/panel/dev/pages-starter", ["root-admin"]);
    expect(await screen.findByText("root toolbox")).toBeInTheDocument();
  });

  it("allows root administrators to refresh upload limits", async () => {
    renderPath("/panel/upload-limits", ["root-admin"]);
    expect(await screen.findByText("root upload limits")).toBeInTheDocument();
  });
  it("allows root administrators to refresh general settings", async () => {
    renderPath("/panel/settings/general", ["root-admin"]);
    expect(await screen.findByText("root general settings")).toBeInTheDocument();
  });
  it.each([["admin"], ["patient"], ["doctor"], null] as const)(
    "refuses general settings for non-root %s",
    async (roles) => {
      renderPath("/panel/settings/general", roles ? [...roles] : null);
      expect(
        await screen.findByText(
          roles === null
            ? "canonical login"
            : roles[0] === "admin"
              ? "canonical admin home"
              : roles[0] === "patient"
                ? "canonical admin home"
                : "canonical admin home",
        ),
      ).toBeInTheDocument();
      expect(screen.queryByText("root general settings")).not.toBeInTheDocument();
    },
  );

  it.each([
    [null, "canonical login"],
    [["admin"], "canonical admin home"],
    [["doctor"], "canonical admin home"],
    [["patient"], "canonical admin home"],
  ] as const)("denies upload limits to identity %j", async (roles, landing) => {
    renderPath("/panel/upload-limits", roles ? [...roles] : null);
    expect(await screen.findByText(landing)).toBeInTheDocument();
    expect(screen.queryByText("root upload limits")).not.toBeInTheDocument();
  });

  it.each(["/panel/dashboard", "/panel/register", "/panel/unknown"])(
    "sends removed or unknown authenticated path %s to the canonical home",
    async (path) => {
      renderPath(path, ["admin"]);
      expect(await screen.findByText("canonical admin home")).toBeInTheDocument();
    },
  );

  it.each(["patient", "doctor", "admin", "root-admin"] as const)(
    "allows %s to open their profile",
    async (role) => {
      renderPath("/panel/profile", [role]);
      expect(await screen.findByText("owner profile")).toBeInTheDocument();
    },
  );
  it.each(["admin", "root-admin"] as const)("allows %s to open a support profile", async (role) => {
    renderPath("/panel/users/01m4hfgan168p6q5ftp528285f", [role]);
    expect(await screen.findByText("support profile")).toBeInTheDocument();
  });
  it.each(["admin", "root-admin"] as const)("allows %s to open activity", async (role) => {
    renderPath("/panel/activity", [role]);
    expect(await screen.findByText("authorized activity")).toBeInTheDocument();
  });
  it.each([
    ["/panel/schedules", "schedule workplaces"],
    ["/panel/payments", "payment list"],
    ["/panel/payments/01m4hfgan168p6q5ftp528285f", "payment details"],
    ["/panel/schedules/workplaces/3", "workplace schedule detail"],
    ["/panel/specialties", "catalog specialties"],
    ["/panel/specialties/5", "catalog specialty details"],
    ["/panel/checkups", "catalog checkups"],
    ["/panel/checkups/5", "catalog checkup details"],
    ["/panel/checkup-categories", "catalog categories"],
    ["/panel/checkup-categories/5", "catalog category details"],
  ])("allows admin/root catalog route %s", async (path, label) => {
    renderPath(path, ["admin"]);
    expect(await screen.findByText(label)).toBeInTheDocument();
  });
  it.each([
    ["/panel/schedules", "schedule workplaces"],
    ["/panel/payments", "payment list"],
    ["/panel/payments/01m4hfgan168p6q5ftp528285f", "payment details"],
    ["/panel/schedules/workplaces/3", "workplace schedule detail"],
    ["/panel/specialties", "catalog specialties"],
    ["/panel/specialties/5", "catalog specialty details"],
    ["/panel/checkups", "catalog checkups"],
    ["/panel/checkups/5", "catalog checkup details"],
    ["/panel/checkup-categories", "catalog categories"],
    ["/panel/checkup-categories/5", "catalog category details"],
  ])("allows root catalog route %s", async (path, label) => {
    renderPath(path, ["root-admin"]);
    expect(await screen.findByText(label)).toBeInTheDocument();
  });
  it.each([
    "/panel/schedules",
    "/panel/payments",
    "/panel/payments/01m4hfgan168p6q5ftp528285f",
    "/panel/schedules/workplaces/3",
    "/panel/specialties",
    "/panel/specialties/5",
    "/panel/checkups",
    "/panel/checkups/5",
    "/panel/checkup-categories",
    "/panel/checkup-categories/5",
  ])("refuses patient catalog route %s", async (path) => {
    renderPath(path, ["patient"]);
    expect(await screen.findByText("canonical admin home")).toBeInTheDocument();
    expect(screen.queryByText(/catalog check/)).toBeNull();
  });
  it.each([
    "/panel/schedules",
    "/panel/payments",
    "/panel/payments/01m4hfgan168p6q5ftp528285f",
    "/panel/schedules/workplaces/3",
    "/panel/specialties",
    "/panel/specialties/5",
    "/panel/checkups",
    "/panel/checkups/5",
    "/panel/checkup-categories",
    "/panel/checkup-categories/5",
  ])("refuses doctor catalog route %s", async (path) => {
    renderPath(path, ["doctor"]);
    expect(await screen.findByText("canonical admin home")).toBeInTheDocument();
    expect(screen.queryByText(/catalog check/)).toBeNull();
  });
  it.each([
    ["patient", "canonical admin home"],
    ["doctor", "canonical admin home"],
  ] as const)("refuses %s the activity route", async (role, landing) => {
    renderPath("/panel/activity", [role]);
    expect(await screen.findByText(landing)).toBeInTheDocument();
    expect(screen.queryByText("authorized activity")).toBeNull();
  });
  it.each([
    ["patient", "canonical admin home"],
    ["doctor", "canonical admin home"],
  ] as const)("refuses %s a support route", async (role, landing) => {
    renderPath("/panel/users/01m4hfgan168p6q5ftp528285f", [role]);
    expect(await screen.findByText(landing)).toBeInTheDocument();
    expect(screen.queryByText("support profile")).toBeNull();
  });

  it("sends a removed guest placeholder to the canonical login", async () => {
    renderPath("/panel/forgot-password", null);
    expect(await screen.findByText("canonical login")).toBeInTheDocument();
  });

  it.each([
    ["/panel", "patient", "canonical admin home"],
    ["/panel/unknown", "doctor", "canonical admin home"],
    ["/panel/doctor/reservations", "patient", "canonical admin home"],
    ["/panel/book", "doctor", "canonical admin home"],
    ["/panel/dev/widgets", "patient", "canonical admin home"],
    ["/panel/my/reservations", "patient", "patient reservations"],
  ] as const)("routes %s for %s without cross-role content", async (path, role, text) => {
    renderPath(path, [role]);
    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(screen.queryByText("marketplace users")).not.toBeInTheDocument();
    expect(screen.queryByText("root toolbox")).not.toBeInTheDocument();
  });
});
