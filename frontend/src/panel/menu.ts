import { manifestRouteHref, visibleManifestNavigation, type ManifestActor } from "../core";
import { adminProductRegistry } from "./registry";

export interface ProductAdminMenuItem {
  readonly active?: boolean;
  readonly product?: boolean;
  readonly subItems?: readonly ProductAdminMenuItem[];
  readonly icon?: string;
  readonly id?: string;
  readonly isHeader?: boolean;
  readonly label: string;
  readonly link?: string;
}

export const createProductAdminMenuItems = (
  actor: ManifestActor,
): readonly ProductAdminMenuItem[] => {
  const routesById = new Map(adminProductRegistry.routes.map((route) => [route.id, route]));
  const productItems: ProductAdminMenuItem[] = visibleManifestNavigation(
    adminProductRegistry,
    actor,
  )
    .filter((item) => item.section === "product" && item.routeId)
    .map((item) => {
      const route = routesById.get(item.routeId!);
      if (!route) throw new Error(`Missing registered route for navigation "${item.id}".`);

      return {
        icon: item.icon,
        id: item.id,
        label: item.id === "patient-questionnaire" ? "questionnaire.available" : item.labelKey,
        link: manifestRouteHref("/", route),
      };
    });

  if (productItems.length === 0) return [];
  if (actor.roles.includes("doctor")) {
    const profileRoute = routesById.get("user.profile");
    if (!profileRoute) throw new Error("Missing owner profile route.");
    productItems.push({
      id: "doctor-practice",
      icon: "ri-stethoscope-line",
      label: "doctorPractice.title",
      link: manifestRouteHref("/", profileRoute),
    });
  }

  const questionnaire = productItems.find((item) => item.id === "patient-questionnaire");
  if (questionnaire)
    productItems.push({
      ...questionnaire,
      id: "patient-submissions",
      label: "questionnaire.history",
      link: questionnaire.link + "?view=submissions",
    });
  const groups = [
    {
      id: "care",
      label: "navigation.appointments",
      icon: "ri-calendar-2-line",
      ids: [
        "admin-reservations",
        "schedules",
        "medical-requests",
        "patient-booking",
        "patient-reservations",
        "doctor-reservations",
        "doctor-practice",
      ],
    },
    {
      id: "questionnaires",
      label: "navigation.questionnaires",
      icon: "ri-survey-line",
      ids: [
        "questionnaires",
        "questionnaire-submissions",
        "patient-questionnaire",
        "patient-submissions",
      ],
    },
    {
      id: "people",
      label: "navigation.people",
      icon: "ri-team-line",
      ids: ["doctors", "patients", "hospitals", "admin-users"],
    },
    {
      id: "catalog",
      label: "navigation.catalog",
      icon: "ri-folder-line",
      ids: ["checkups", "checkup-categories", "specialties"],
    },
    {
      id: "content",
      label: "navigation.content",
      icon: "ri-article-line",
      ids: ["articles", "article-create", "article-taxonomies", "patient-articles"],
    },
    {
      id: "settings",
      label: "navigation.settings",
      icon: "ri-settings-3-line",
      ids: ["admin-general-settings", "admin-upload-limits"],
    },
  ];
  const emitted = new Set<string>();
  const grouped: ProductAdminMenuItem[] = [];
  for (const item of productItems) {
    const group = groups.find((candidate) => candidate.ids.includes(item.id ?? ""));
    if (!group) {
      grouped.push({ ...item, product: true });
      continue;
    }
    if (emitted.has(group.id)) continue;
    emitted.add(group.id);
    const children = group.ids
      .flatMap((id) => productItems.filter((child) => child.id === id))
      .map((child) => ({ ...child, product: true }));
    if (children.length === 1) grouped.push(children[0]!);
    else
      grouped.push({
        id: "product-" + group.id,
        label: group.label,
        icon: group.icon,
        product: true,
        subItems: children,
      });
  }

  return [
    {
      label:
        actor.roles.includes("root-admin") || actor.roles.includes("admin")
          ? "product.navigation.productAdmin"
          : actor.roles.includes("doctor")
            ? "booking.doctorPanel"
            : "booking.patientPanel",
      isHeader: true,
    },
    ...grouped,
  ];
};

// Use the existing route and its query state; details retain their list's parent.
export const productMenuLinkActive = (
  link: string | undefined,
  pathname: string,
  search: string,
) => {
  if (!link) return false;
  const [path, query] = link.split("?");
  if (path === "/articles" && pathname === "/articles/new") return false;
  if (path === "/my/questionnaire") {
    if (pathname !== path) return false;
    const params = new URLSearchParams(search);
    const history = params.get("view") === "submissions" || params.has("submission");
    return query ? history : !history;
  }
  return pathname === path || (path !== "/" && pathname.startsWith(path + "/"));
};
