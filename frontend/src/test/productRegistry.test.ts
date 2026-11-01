import { describe, expect, it } from "vitest";

import {
  createDevelopmentManifest,
  defineDevtoolModule,
  manifestRouteHref,
  visibleManifestNavigation,
  visibleManifestRoutes,
} from "../core";
import { createProductAdminMenuItems } from "../panel/menu";
import { adminProductRegistry } from "../panel/registry";

const guest = { authenticated: false, roles: [] } as const;
const admin = { authenticated: true, roles: ["admin"] } as const;
const rootAdmin = { authenticated: true, roles: ["root-admin"] } as const;

describe("Checkupino product registry", () => {
  it("keeps the patient article library and details out of staff and guest routes", () => {
    const patient = { authenticated: true, roles: ["patient"] };
    const paths = visibleManifestRoutes(adminProductRegistry, patient).map((route) => route.path);
    expect(paths).toContain("my/articles");
    expect(paths).toContain("my/articles/:articleId");
    for (const actor of [guest, admin, rootAdmin, { authenticated: true, roles: ["doctor"] }]) {
      expect(
        visibleManifestRoutes(adminProductRegistry, actor).map((route) => route.path),
      ).not.toContain("my/articles");
    }
    expect(JSON.stringify(createProductAdminMenuItems(patient))).toContain("patient-articles");
  });
  it("owns one canonical record for each approved neutral navigable entry", () => {
    expect(
      adminProductRegistry.routes.map(({ id, moduleId, path, titleKey }) => ({
        id,
        moduleId,
        path,
        titleKey,
      })),
    ).toEqual([
      ...[
        ["articles", "articles"],
        ["article-create", "articles/new"],
        ["article-detail", "articles/:articleId"],
        ["article-taxonomies", "article-taxonomies"],
        ["medical-requests", "medical-requests"],
        ["medical-detail", "medical-requests/:requestId"],
        ["questionnaires", "questionnaires"],
        ["questionnaire-detail", "questionnaires/:questionnaireId"],
        ["questionnaire-submissions", "questionnaire-submissions"],
        ["submission-detail", "questionnaire-submissions/:submissionId"],
        ["doctors", "doctors"],
        ["patients", "patients"],
        ["doctor-create", "doctors/new"],
        ["patient-create", "patients/new"],
        ["hospitals", "hospitals"],
        ["hospital-create", "hospitals/new"],
        ["hospital-detail", "hospitals/:hospitalId"],
        ["schedule-index-redirect", "schedules/workplaces"],
        ["activity", "activity"],
        ["schedules", "schedules"],
        ["payments", "payments"],
        ["payment-detail", "payments/:paymentId"],
        ["schedule-detail", "schedules/workplaces/:workplaceId"],
        ["specialties", "specialties"],
        ["specialty-detail", "specialties/:specialtyId"],
        ["checkups", "checkups"],
        ["checkup-detail", "checkups/:checkupId"],
        ["checkup-categories", "checkup-categories"],
        ["category-detail", "checkup-categories/:categoryId"],
      ].map(([id, path]) => ({
        id: `admin.${id}`,
        moduleId: "checkupino",
        path,
        titleKey: `adminManage.${id}`,
      })),
      {
        id: "auth.login",
        moduleId: "checkupino",
        path: "login",
        titleKey: "routes.auth.login",
      },
      {
        id: "admin.home",
        moduleId: "checkupino",
        path: "",
        titleKey: "routes.admin.home",
      },
      {
        id: "admin.users",
        moduleId: "checkupino",
        path: "users",
        titleKey: "users.staff",
      },
      {
        id: "user.profile",
        moduleId: "checkupino",
        path: "profile",
        titleKey: "profileOverview.title",
      },
      {
        id: "admin.support-profile",
        moduleId: "checkupino",
        path: "users/:userId",
        titleKey: "profileOverview.support",
      },
      {
        id: "admin.reservations",
        moduleId: "checkupino",
        path: "reservations",
        titleKey: "adminReservations.title",
      },
      {
        id: "admin.reservation-detail",
        moduleId: "checkupino",
        path: "reservations/:reservationId",
        titleKey: "adminReservations.detailTitle",
      },
      {
        id: "admin.upload-limits",
        moduleId: "checkupino",
        path: "upload-limits",
        titleKey: "uploads.title",
      },
      {
        id: "admin.general-settings",
        moduleId: "checkupino",
        path: "settings/general",
        titleKey: "generalSettings.title",
      },
      { id: "patient.booking", moduleId: "checkupino", path: "book", titleKey: "booking.title" },
      {
        id: "patient.articles",
        moduleId: "checkupino",
        path: "my/articles",
        titleKey: "patientArticles.title",
      },
      {
        id: "patient.article-detail",
        moduleId: "checkupino",
        path: "my/articles/:articleId",
        titleKey: "patientArticles.article",
      },
      {
        id: "patient.reservations",
        moduleId: "checkupino",
        path: "my/reservations",
        titleKey: "booking.myReservations",
      },
      {
        id: "patient.questionnaire",
        moduleId: "checkupino",
        path: "my/questionnaire",
        titleKey: "questionnaire.title",
      },
      {
        id: "doctor.reservations",
        moduleId: "checkupino",
        path: "doctor/reservations",
        titleKey: "booking.doctorReservations",
      },
      {
        id: "patient.medical",
        moduleId: "checkupino",
        path: "my/reservations/:reservationId/medical",
        titleKey: "medical.title",
      },
      {
        id: "doctor.medical",
        moduleId: "checkupino",
        path: "doctor/reservations/:reservationId/medical",
        titleKey: "medical.title",
      },
    ]);
    expect(
      [...adminProductRegistry.navigation].sort((left, right) => left.id.localeCompare(right.id)),
    ).toMatchObject(
      [
        ...[
          "articles",
          "article-create",
          "article-taxonomies",
          "medical-requests",
          "questionnaires",
          "questionnaire-submissions",
          "doctors",
          "patients",
          "hospitals",
          "activity",
          "checkups",
          "checkup-categories",
          "specialties",
          "schedules",
          "payments",
        ].map((id) => ({
          id,
          moduleId: "checkupino",
          routeId: `admin.${id}`,
          section: "product",
        })),
        {
          id: "admin-home",
          moduleId: "checkupino",
          routeId: "admin.home",
          section: "product",
        },
        {
          id: "admin-users",
          moduleId: "checkupino",
          routeId: "admin.users",
          section: "product",
        },
        {
          id: "admin-reservations",
          moduleId: "checkupino",
          routeId: "admin.reservations",
          section: "product",
        },
        {
          id: "admin-upload-limits",
          moduleId: "checkupino",
          routeId: "admin.upload-limits",
          section: "product",
        },
        {
          id: "admin-general-settings",
          moduleId: "checkupino",
          routeId: "admin.general-settings",
          section: "product",
        },
        {
          id: "system-extension-slot",
          inert: true,
          moduleId: "checkupino",
          section: "system",
        },
        {
          id: "patient-booking",
          moduleId: "checkupino",
          routeId: "patient.booking",
          section: "product",
        },
        {
          id: "patient-articles",
          moduleId: "checkupino",
          routeId: "patient.articles",
          section: "product",
        },
        {
          id: "patient-reservations",
          moduleId: "checkupino",
          routeId: "patient.reservations",
          section: "product",
        },
        {
          id: "patient-questionnaire",
          moduleId: "checkupino",
          routeId: "patient.questionnaire",
          section: "product",
        },
        {
          id: "doctor-reservations",
          moduleId: "checkupino",
          routeId: "doctor.reservations",
          section: "product",
        },
      ].sort((left, right) => left.id.localeCompare(right.id)),
    );
  });

  it("derives guest, admin, and root visibility from route access once", () => {
    expect(visibleManifestRoutes(adminProductRegistry, guest).map((route) => route.id)).toEqual([
      "auth.login",
    ]);
    expect(visibleManifestRoutes(adminProductRegistry, admin).map((route) => route.id)).toEqual([
      "admin.articles",
      "admin.article-create",
      "admin.article-detail",
      "admin.article-taxonomies",
      "admin.medical-requests",
      "admin.medical-detail",
      "admin.questionnaires",
      "admin.questionnaire-detail",
      "admin.questionnaire-submissions",
      "admin.submission-detail",
      "admin.doctors",
      "admin.patients",
      "admin.doctor-create",
      "admin.patient-create",
      "admin.hospitals",
      "admin.hospital-create",
      "admin.hospital-detail",
      "admin.schedule-index-redirect",
      "admin.activity",
      "admin.schedules",
      "admin.payments",
      "admin.payment-detail",
      "admin.schedule-detail",
      "admin.specialties",
      "admin.specialty-detail",
      "admin.checkups",
      "admin.checkup-detail",
      "admin.checkup-categories",
      "admin.category-detail",
      "admin.home",
      "user.profile",
      "admin.support-profile",
      "admin.reservations",
      "admin.reservation-detail",
    ]);
    expect(visibleManifestNavigation(adminProductRegistry, admin).map((item) => item.id)).toEqual([
      "admin-home",
      "admin-reservations",
      "medical-requests",
      "questionnaires",
      "questionnaire-submissions",
      "doctors",
      "patients",
      "hospitals",
      "activity",
      "checkups",
      "checkup-categories",
      "specialties",
      "schedules",
      "payments",
      "articles",
      "article-create",
      "article-taxonomies",
    ]);
    expect(
      visibleManifestNavigation(adminProductRegistry, rootAdmin).map((item) => item.id),
    ).toEqual([
      "admin-home",
      "admin-reservations",
      "medical-requests",
      "questionnaires",
      "questionnaire-submissions",
      "doctors",
      "patients",
      "admin-users",
      "hospitals",
      "activity",
      "checkups",
      "checkup-categories",
      "specialties",
      "schedules",
      "payments",
      "articles",
      "article-create",
      "article-taxonomies",
      "admin-general-settings",
      "admin-upload-limits",
      "system-extension-slot",
    ]);
    expect(visibleManifestNavigation(adminProductRegistry, guest)).toEqual([]);
  });

  it("groups visible product records without widening role access", () => {
    expect(createProductAdminMenuItems(guest)).toEqual([]);
    const leaves = (actor: Parameters<typeof createProductAdminMenuItems>[0]) =>
      createProductAdminMenuItems(actor).flatMap(
        (item) => item.subItems ?? (item.link ? [item] : []),
      );
    expect(leaves(admin).map((item) => item.link)).toEqual([
      "/",
      "/reservations",
      "/schedules",
      "/medical-requests",
      "/questionnaires",
      "/questionnaire-submissions",
      "/doctors",
      "/patients",
      "/hospitals",
      "/activity",
      "/checkups",
      "/checkup-categories",
      "/specialties",
      "/payments",
      "/articles",
      "/articles/new",
      "/article-taxonomies",
    ]);
    expect(leaves(rootAdmin).map((item) => item.link)).toContain("/users");
    expect(leaves(rootAdmin).map((item) => item.link)).toContain("/settings/general");
    expect(leaves(rootAdmin).map((item) => item.link)).toContain("/upload-limits");
    expect(
      createProductAdminMenuItems(admin)
        .filter((item) => item.subItems)
        .map((item) => item.id),
    ).toEqual([
      "product-care",
      "product-questionnaires",
      "product-people",
      "product-catalog",
      "product-content",
    ]);
    const patient = { authenticated: true, roles: ["patient"] };
    expect(leaves(patient).map((item) => item.link)).toEqual([
      "/",
      "/book",
      "/my/reservations",
      "/my/questionnaire",
      "/my/questionnaire?view=submissions",
      "/my/articles",
    ]);
    expect(new Set(leaves(rootAdmin).map((item) => item.link)).size).toBe(leaves(rootAdmin).length);
  });

  it.each([
    [
      "patient",
      [
        "patient.booking",
        "patient.articles",
        "patient.article-detail",
        "patient.reservations",
        "patient.questionnaire",
        "patient.medical",
      ],
      "booking.patientPanel",
    ],
    ["doctor", ["doctor.reservations", "doctor.medical"], "booking.doctorPanel"],
  ] as const)("keeps %s routes and navigation in their own version", (role, routes, header) => {
    const actor = { authenticated: true, roles: [role] };
    expect(visibleManifestRoutes(adminProductRegistry, actor).map((route) => route.id)).toEqual([
      "admin.home",
      "user.profile",
      ...routes,
    ]);
    expect(createProductAdminMenuItems(actor)[0]?.label).toBe(header);
    expect(createProductAdminMenuItems(actor).some((item) => item.link === "/users")).toBe(false);
    expect(createProductAdminMenuItems(actor).some((item) => item.link === "/upload-limits")).toBe(
      false,
    );
  });

  it("resolves the same relative records under root and subpath bases", () => {
    const login = adminProductRegistry.routes.find((route) => route.id === "auth.login");
    const home = adminProductRegistry.routes.find((route) => route.id === "admin.home");
    expect(login).toBeDefined();
    expect(home).toBeDefined();
    expect(manifestRouteHref("/", login!)).toBe("/login");
    expect(manifestRouteHref("/panel/", login!)).toBe("/panel/login");
    expect(manifestRouteHref("/panel", home!)).toBe("/panel");
    expect(manifestRouteHref("/control/", home!)).toBe("/control");
  });

  it("keeps missing and optional devtool modules inert", () => {
    const emptyDevtools = defineDevtoolModule({
      id: "empty-reference",
      kind: "devtool",
      navigation: [],
      routes: [],
    });
    const withoutDevtools = createDevelopmentManifest(adminProductRegistry.modules, []);
    const withEmptyDevtools = createDevelopmentManifest(adminProductRegistry.modules, [
      emptyDevtools,
    ]);
    expect(withoutDevtools.devtools).toEqual([]);
    expect(withEmptyDevtools.routes).toHaveLength(adminProductRegistry.routes.length);
    expect(withEmptyDevtools.navigation).toHaveLength(adminProductRegistry.navigation.length);
  });

  it("does not allow a future slot to become clickable without a route", () => {
    const futureModule = defineDevtoolModule({
      id: "future-reference",
      kind: "devtool",
      navigation: [
        {
          id: "future-reference-slot",
          inert: true,
          labelKey: "navigation.future-reference",
          order: 100,
          roles: ["root-admin"],
          section: "developer",
        },
      ],
      routes: [],
    });
    const manifest = createDevelopmentManifest(adminProductRegistry.modules, [futureModule]);

    expect(visibleManifestNavigation(manifest, admin)).toEqual([
      expect.objectContaining({ id: "admin-home" }),
      expect.objectContaining({ id: "admin-reservations" }),
      expect.objectContaining({ id: "medical-requests" }),
      expect.objectContaining({ id: "questionnaires" }),
      expect.objectContaining({ id: "questionnaire-submissions" }),
      expect.objectContaining({ id: "doctors" }),
      expect.objectContaining({ id: "patients" }),
      expect.objectContaining({ id: "hospitals" }),
      expect.objectContaining({ id: "activity" }),
      expect.objectContaining({ id: "checkups" }),
      expect.objectContaining({ id: "checkup-categories" }),
      expect.objectContaining({ id: "specialties" }),
      expect.objectContaining({ id: "schedules" }),
      expect.objectContaining({ id: "payments" }),
      expect.objectContaining({ id: "articles" }),
      expect.objectContaining({ id: "article-create" }),
      expect.objectContaining({ id: "article-taxonomies" }),
    ]);
    const rootNavigation = visibleManifestNavigation(manifest, rootAdmin);
    expect(rootNavigation).toEqual([
      expect.objectContaining({ id: "admin-home" }),
      expect.objectContaining({ id: "admin-reservations" }),
      expect.objectContaining({ id: "medical-requests" }),
      expect.objectContaining({ id: "questionnaires" }),
      expect.objectContaining({ id: "questionnaire-submissions" }),
      expect.objectContaining({ id: "doctors" }),
      expect.objectContaining({ id: "patients" }),
      expect.objectContaining({ id: "admin-users" }),
      expect.objectContaining({ id: "hospitals" }),
      expect.objectContaining({ id: "activity" }),
      expect.objectContaining({ id: "checkups" }),
      expect.objectContaining({ id: "checkup-categories" }),
      expect.objectContaining({ id: "specialties" }),
      expect.objectContaining({ id: "schedules" }),
      expect.objectContaining({ id: "payments" }),
      expect.objectContaining({ id: "articles" }),
      expect.objectContaining({ id: "article-create" }),
      expect.objectContaining({ id: "article-taxonomies" }),
      expect.objectContaining({ id: "admin-general-settings" }),
      expect.objectContaining({ id: "admin-upload-limits" }),
      expect.objectContaining({
        id: "system-extension-slot",
        inert: true,
        section: "system",
      }),
      expect.objectContaining({ id: "future-reference-slot", inert: true }),
    ]);
    expect(
      rootNavigation.find((item) => item.id === "system-extension-slot")?.routeId,
    ).toBeUndefined();
    expect(
      rootNavigation.find((item) => item.id === "future-reference-slot")?.routeId,
    ).toBeUndefined();
  });
});
