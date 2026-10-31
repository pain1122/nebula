import { createProductManifest } from "../core";
import { createCheckupinoModule } from "../modules/checkupino/manifest";

export const adminProductRegistry = createProductManifest([
  createCheckupinoModule({
    articles: () => import("../pages/Administration/content/Articles"),
    articleCreate: () =>
      import("../pages/Administration/content/Articles").then((page) => ({
        default: page.NewArticle,
      })),
    articleDetail: () =>
      import("../pages/Administration/content/Articles").then((page) => ({
        default: page.ArticleWorkspace,
      })),
    articleTaxonomies: () => import("../pages/Administration/content/Taxonomies"),
    home: () => import("../pages/DashboardEcommerce/ProductDashboard"),
    login: () => import("../pages/Authentication/Login"),
    users: () => import("../pages/Users/UserDirectory"),
    activity: () => import("../pages/Administration/Activity"),
    schedules: () => import("../pages/Administration/Schedules"),
    payments: () => import("../pages/Administration/Payments"),
    paymentDetail: () =>
      import("../pages/Administration/Payments").then((page) => ({ default: page.PaymentDetail })),
    scheduleDetail: () =>
      import("../pages/Administration/Schedules").then((page) => ({
        default: page.WorkplaceSchedule,
      })),
    checkups: () => import("../pages/Administration/Catalog"),
    categories: () =>
      import("../pages/Administration/Catalog").then((page) => ({ default: page.Categories })),
    specialties: () =>
      import("../pages/Administration/Catalog").then((page) => ({ default: page.Specialties })),
    specialtyDetail: () =>
      import("../pages/Administration/CatalogDetail").then((page) => ({
        default: page.SpecialtyDetail,
      })),
    checkupDetail: () => import("../pages/Administration/CatalogDetail"),
    categoryDetail: () =>
      import("../pages/Administration/CatalogDetail").then((page) => ({
        default: page.CategoryDetail,
      })),
    doctors: () =>
      import("../pages/Users/UserDirectory").then((page) => ({ default: page.Doctors })),
    patients: () =>
      import("../pages/Users/UserDirectory").then((page) => ({ default: page.Patients })),
    doctorCreate: () => import("../pages/Users/ClinicalAccountCreate"),
    patientCreate: () =>
      import("../pages/Users/ClinicalAccountCreate").then((page) => ({
        default: page.PatientCreate,
      })),
    hospitals: () => import("../pages/Administration/Hospitals"),
    hospitalCreate: () =>
      import("../pages/Administration/Hospitals").then((page) => ({
        default: page.HospitalCreate,
      })),
    hospitalDetail: () =>
      import("../pages/Administration/Hospitals").then((page) => ({ default: page.HospitalPage })),
    scheduleIndexRedirect: () => import("../pages/Administration/ScheduleIndexRedirect"),
    profile: () => import("../pages/Users/UserProfile"),
    supportProfile: () =>
      import("../pages/Users/UserProfile").then((page) => ({ default: page.SupportProfile })),
    adminReservations: () => import("../pages/Reservations/AdminReservations"),
    adminReservationDetail: () => import("../pages/Reservations/AdminReservationDetail"),
    adminMedicalRequests: () => import("../pages/Administration/Collections"),
    adminMedicalDetail: () => import("../pages/Administration/MedicalDetail"),
    adminQuestionnaires: () =>
      import("../pages/Administration/Collections").then((page) => ({
        default: page.Questionnaires,
      })),
    adminQuestionnaireDetail: () => import("../pages/Administration/QuestionnaireDetail"),
    adminSubmissions: () =>
      import("../pages/Administration/Collections").then((page) => ({ default: page.Submissions })),
    adminSubmissionDetail: () => import("../pages/Administration/SubmissionDetail"),
    uploadLimits: () => import("../pages/Uploads/UploadLimits"),
    generalSettings: () => import("../pages/Administration/GeneralSettings"),
    booking: () => import("../pages/Booking/PatientBooking"),
    patientReservations: () => import("../pages/Booking/PatientReservations"),
    doctorReservations: () => import("../pages/Booking/DoctorReservations"),
    patientMedical: () => import("../pages/Medical/MedicalFiles"),
    questionnaire: () => import("../pages/Questionnaire/QuestionnaireWorkspace"),
    doctorMedical: () =>
      import("../pages/Medical/MedicalFiles").then((page) => ({
        default: page.DoctorMedicalFiles,
      })),
  }),
]);
