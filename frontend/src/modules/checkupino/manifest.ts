import { defineProductModule, type RouteLoader } from "../../core";

export interface CheckupinoRouteLoaders {
  readonly articles: RouteLoader;
  readonly articleCreate: RouteLoader;
  readonly articleDetail: RouteLoader;
  readonly articleTaxonomies: RouteLoader;
  readonly home: RouteLoader;
  readonly login: RouteLoader;
  readonly users: RouteLoader;
  readonly doctors: RouteLoader;
  readonly patients: RouteLoader;
  readonly doctorCreate: RouteLoader;
  readonly patientCreate: RouteLoader;
  readonly hospitals: RouteLoader;
  readonly hospitalCreate: RouteLoader;
  readonly hospitalDetail: RouteLoader;
  readonly scheduleIndexRedirect: RouteLoader;
  readonly activity: RouteLoader;
  readonly schedules: RouteLoader;
  readonly scheduleDetail: RouteLoader;
  readonly payments: RouteLoader;
  readonly paymentDetail: RouteLoader;
  readonly checkups: RouteLoader;
  readonly categories: RouteLoader;
  readonly specialties: RouteLoader;
  readonly specialtyDetail: RouteLoader;
  readonly checkupDetail: RouteLoader;
  readonly categoryDetail: RouteLoader;
  readonly profile: RouteLoader;
  readonly supportProfile: RouteLoader;
  readonly adminReservations: RouteLoader;
  readonly adminReservationDetail: RouteLoader;
  readonly adminMedicalRequests: RouteLoader;
  readonly adminMedicalDetail: RouteLoader;
  readonly adminQuestionnaires: RouteLoader;
  readonly adminQuestionnaireDetail: RouteLoader;
  readonly adminSubmissions: RouteLoader;
  readonly adminSubmissionDetail: RouteLoader;
  readonly uploadLimits: RouteLoader;
  readonly generalSettings: RouteLoader;
  readonly booking: RouteLoader;
  readonly patientReservations: RouteLoader;
  readonly doctorReservations: RouteLoader;
  readonly patientMedical: RouteLoader;
  readonly doctorMedical: RouteLoader;
  readonly questionnaire: RouteLoader;
}

const adminRoles = ["admin", "root-admin"] as const;

export const createCheckupinoModule = (loaders: CheckupinoRouteLoaders) =>
  defineProductModule({
    id: "checkupino",
    kind: "product",
    navigation: [
      ...[
        { id: "medical-requests", icon: "ri-folder-shield-2-line", order: 13 },
        { id: "questionnaires", icon: "ri-survey-line", order: 14 },
        { id: "questionnaire-submissions", icon: "ri-file-list-3-line", order: 15 },
        { id: "doctors", icon: "ri-stethoscope-line", order: 16 },
        { id: "patients", icon: "ri-user-heart-line", order: 17 },
        { id: "hospitals", icon: "ri-hospital-line", order: 18 },
        { id: "activity", icon: "ri-history-line", order: 19 },
        { id: "checkups", icon: "ri-stethoscope-line", order: 20 },
        { id: "checkup-categories", icon: "ri-folder-line", order: 21 },
        { id: "specialties", icon: "ri-node-tree", order: 22 },
        { id: "schedules", icon: "ri-calendar-2-line", order: 23 },
        { id: "payments", icon: "ri-bank-card-line", order: 24 },
        { id: "articles", icon: "ri-article-line", order: 25 },
        { id: "article-create", icon: "ri-add-circle-line", order: 26 },
        { id: "article-taxonomies", icon: "ri-price-tag-3-line", order: 27 },
      ].map((item) => ({
        ...item,
        labelKey: `adminManage.${item.id}`,
        routeId: `admin.${item.id}`,
        section: "product" as const,
      })),
      {
        icon: "ri-dashboard-2-line",
        id: "admin-home",
        labelKey: "product.navigation.home",
        order: 10,
        routeId: "admin.home",
        section: "product",
      },
      {
        icon: "ri-group-line",
        id: "admin-users",
        labelKey: "users.staff",
        order: 18,
        routeId: "admin.users",
        section: "product",
      },
      {
        icon: "ri-calendar-line",
        id: "admin-reservations",
        labelKey: "adminReservations.title",
        order: 12,
        routeId: "admin.reservations",
        section: "product",
      },
      {
        icon: "ri-file-settings-line",
        id: "admin-upload-limits",
        labelKey: "product.navigation.uploadLimits",
        order: 29,
        routeId: "admin.upload-limits",
        section: "product",
      },
      {
        icon: "ri-settings-3-line",
        id: "admin-general-settings",
        labelKey: "generalSettings.title",
        order: 28,
        routeId: "admin.general-settings",
        section: "product",
      },
      {
        id: "system-extension-slot",
        inert: true,
        labelKey: "product.navigation.system",
        order: 30,
        roles: ["root-admin"],
        section: "system",
      },
      {
        icon: "ri-calendar-check-line",
        id: "patient-booking",
        labelKey: "booking.title",
        order: 10,
        routeId: "patient.booking",
        section: "product",
      },
      {
        icon: "ri-calendar-line",
        id: "patient-reservations",
        labelKey: "booking.myReservations",
        order: 15,
        routeId: "patient.reservations",
        section: "product",
      },
      {
        icon: "ri-survey-line",
        id: "patient-questionnaire",
        labelKey: "questionnaire.title",
        order: 20,
        routeId: "patient.questionnaire",
        section: "product",
      },
      {
        icon: "ri-calendar-line",
        id: "doctor-reservations",
        labelKey: "booking.doctorReservations",
        order: 10,
        routeId: "doctor.reservations",
        section: "product",
      },
    ],
    routes: [
      ...[
        { id: "articles", path: "articles", load: loaders.articles },
        { id: "article-create", path: "articles/new", load: loaders.articleCreate },
        { id: "article-detail", path: "articles/:articleId", load: loaders.articleDetail },
        { id: "article-taxonomies", path: "article-taxonomies", load: loaders.articleTaxonomies },
        { id: "medical-requests", path: "medical-requests", load: loaders.adminMedicalRequests },
        {
          id: "medical-detail",
          path: "medical-requests/:requestId",
          load: loaders.adminMedicalDetail,
        },
        { id: "questionnaires", path: "questionnaires", load: loaders.adminQuestionnaires },
        {
          id: "questionnaire-detail",
          path: "questionnaires/:questionnaireId",
          load: loaders.adminQuestionnaireDetail,
        },
        {
          id: "questionnaire-submissions",
          path: "questionnaire-submissions",
          load: loaders.adminSubmissions,
        },
        {
          id: "submission-detail",
          path: "questionnaire-submissions/:submissionId",
          load: loaders.adminSubmissionDetail,
        },
        { id: "doctors", path: "doctors", load: loaders.doctors },
        { id: "patients", path: "patients", load: loaders.patients },
        { id: "doctor-create", path: "doctors/new", load: loaders.doctorCreate },
        { id: "patient-create", path: "patients/new", load: loaders.patientCreate },
        { id: "hospitals", path: "hospitals", load: loaders.hospitals },
        { id: "hospital-create", path: "hospitals/new", load: loaders.hospitalCreate },
        { id: "hospital-detail", path: "hospitals/:hospitalId", load: loaders.hospitalDetail },
        {
          id: "schedule-index-redirect",
          path: "schedules/workplaces",
          load: loaders.scheduleIndexRedirect,
        },
        { id: "activity", path: "activity", load: loaders.activity },
        { id: "schedules", path: "schedules", load: loaders.schedules },
        { id: "payments", path: "payments", load: loaders.payments },
        { id: "payment-detail", path: "payments/:paymentId", load: loaders.paymentDetail },
        {
          id: "schedule-detail",
          path: "schedules/workplaces/:workplaceId",
          load: loaders.scheduleDetail,
        },
        { id: "specialties", path: "specialties", load: loaders.specialties },
        { id: "specialty-detail", path: "specialties/:specialtyId", load: loaders.specialtyDetail },
        { id: "checkups", path: "checkups", load: loaders.checkups },
        { id: "checkup-detail", path: "checkups/:checkupId", load: loaders.checkupDetail },
        { id: "checkup-categories", path: "checkup-categories", load: loaders.categories },
        {
          id: "category-detail",
          path: "checkup-categories/:categoryId",
          load: loaders.categoryDetail,
        },
      ].map((item) => ({
        ...item,
        id: `admin.${item.id}`,
        access: { audience: "authenticated" as const, roles: adminRoles },
        breadcrumbs: [{ labelKey: "product.navigation.home", routeId: "admin.home" }],
        titleKey: `adminManage.${item.id}`,
      })),
      {
        access: { audience: "guest" },
        breadcrumbs: [],
        id: "auth.login",
        load: loaders.login,
        path: "login",
        titleKey: "routes.auth.login",
      },
      {
        access: { audience: "authenticated", roles: ["patient", "doctor", "admin", "root-admin"] },
        breadcrumbs: [{ labelKey: "product.navigation.home", routeId: "admin.home" }],
        id: "admin.home",
        load: loaders.home,
        path: "",
        titleKey: "routes.admin.home",
      },
      {
        access: { audience: "authenticated", roles: ["root-admin"] },
        breadcrumbs: [
          { labelKey: "product.navigation.home", routeId: "admin.home" },
          { labelKey: "users.staff", routeId: "admin.users" },
        ],
        id: "admin.users",
        load: loaders.users,
        path: "users",
        titleKey: "users.staff",
      },
      {
        access: { audience: "authenticated", roles: ["patient", "doctor", "admin", "root-admin"] },
        breadcrumbs: [],
        id: "user.profile",
        load: loaders.profile,
        path: "profile",
        titleKey: "profileOverview.title",
      },
      {
        access: { audience: "authenticated", roles: adminRoles },
        breadcrumbs: [],
        id: "admin.support-profile",
        load: loaders.supportProfile,
        path: "users/:userId",
        titleKey: "profileOverview.support",
      },
      {
        access: { audience: "authenticated", roles: adminRoles },
        breadcrumbs: [{ labelKey: "product.navigation.home", routeId: "admin.home" }],
        id: "admin.reservations",
        load: loaders.adminReservations,
        path: "reservations",
        titleKey: "adminReservations.title",
      },
      {
        access: { audience: "authenticated", roles: adminRoles },
        breadcrumbs: [{ labelKey: "adminReservations.title", routeId: "admin.reservations" }],
        id: "admin.reservation-detail",
        load: loaders.adminReservationDetail,
        path: "reservations/:reservationId",
        titleKey: "adminReservations.detailTitle",
      },
      {
        access: { audience: "authenticated", roles: ["root-admin"] },
        breadcrumbs: [
          { labelKey: "product.navigation.home", routeId: "admin.home" },
          { labelKey: "product.navigation.uploadLimits", routeId: "admin.upload-limits" },
        ],
        id: "admin.upload-limits",
        load: loaders.uploadLimits,
        path: "upload-limits",
        titleKey: "uploads.title",
      },
      {
        access: { audience: "authenticated", roles: ["root-admin"] },
        breadcrumbs: [
          { labelKey: "product.navigation.home", routeId: "admin.home" },
          { labelKey: "generalSettings.title", routeId: "admin.general-settings" },
        ],
        id: "admin.general-settings",
        load: loaders.generalSettings,
        path: "settings/general",
        titleKey: "generalSettings.title",
      },
      {
        access: { audience: "authenticated", roles: ["patient"] },
        breadcrumbs: [],
        id: "patient.booking",
        load: loaders.booking,
        path: "book",
        titleKey: "booking.title",
      },
      {
        access: { audience: "authenticated", roles: ["patient"] },
        breadcrumbs: [],
        id: "patient.reservations",
        load: loaders.patientReservations,
        path: "my/reservations",
        titleKey: "booking.myReservations",
      },
      {
        access: { audience: "authenticated", roles: ["patient"] },
        breadcrumbs: [],
        id: "patient.questionnaire",
        load: loaders.questionnaire,
        path: "my/questionnaire",
        titleKey: "questionnaire.title",
      },
      {
        access: { audience: "authenticated", roles: ["doctor"] },
        breadcrumbs: [],
        id: "doctor.reservations",
        load: loaders.doctorReservations,
        path: "doctor/reservations",
        titleKey: "booking.doctorReservations",
      },
      {
        access: { audience: "authenticated", roles: ["patient"] },
        breadcrumbs: [{ labelKey: "booking.myReservations", routeId: "patient.reservations" }],
        id: "patient.medical",
        load: loaders.patientMedical,
        path: "my/reservations/:reservationId/medical",
        titleKey: "medical.title",
      },
      {
        access: { audience: "authenticated", roles: ["doctor"] },
        breadcrumbs: [{ labelKey: "booking.doctorReservations", routeId: "doctor.reservations" }],
        id: "doctor.medical",
        load: loaders.doctorMedical,
        path: "doctor/reservations/:reservationId/medical",
        titleKey: "medical.title",
      },
    ],
  });
