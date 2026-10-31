import type { ComponentType } from "react";

import { joinPath, normalizeRouterBase } from "./runtime/config";

export type ModuleKind = "devtool" | "product";
export type NavigationSection = "developer" | "product" | "system";

export interface AccessContribution {
  readonly audience: "authenticated" | "guest";
  readonly roles?: readonly string[];
}

export interface BreadcrumbContribution {
  readonly labelKey: string;
  readonly routeId?: string;
}

export interface RouteContribution {
  readonly access: AccessContribution;
  readonly breadcrumbs: readonly BreadcrumbContribution[];
  readonly id: string;
  readonly load: RouteLoader;
  readonly path: string;
  readonly titleKey: string;
}

export type RouteLoader = () => Promise<{ default: ComponentType<any> }>;

export interface NavigationContribution {
  readonly icon?: string;
  readonly id: string;
  readonly inert?: boolean;
  readonly labelKey: string;
  readonly order: number;
  readonly roles?: readonly string[];
  readonly routeId?: string;
  readonly section: NavigationSection;
}

export interface RegisteredRouteContribution extends RouteContribution {
  readonly moduleId: string;
}

export interface RegisteredNavigationContribution extends NavigationContribution {
  readonly moduleId: string;
}

interface ModuleContribution<TKind extends ModuleKind> {
  readonly id: string;
  readonly kind: TKind;
  readonly navigation: readonly NavigationContribution[];
  readonly routes: readonly RouteContribution[];
}

export type ProductModule = ModuleContribution<"product">;
export type DevtoolModule = ModuleContribution<"devtool">;

export interface ProductManifest {
  readonly devtools: readonly DevtoolModule[];
  readonly kind: "product";
  readonly modules: readonly ProductModule[];
  readonly navigation: readonly RegisteredNavigationContribution[];
  readonly routes: readonly RegisteredRouteContribution[];
}

export interface DevelopmentManifest {
  readonly devtools: readonly DevtoolModule[];
  readonly kind: "development";
  readonly modules: readonly ProductModule[];
  readonly navigation: readonly RegisteredNavigationContribution[];
  readonly routes: readonly RegisteredRouteContribution[];
}

export interface ManifestActor {
  readonly authenticated: boolean;
  readonly roles: readonly string[];
}

export class ManifestError extends Error {
  constructor(message: string) {
    super(`Invalid platform manifest: ${message}`);
    this.name = "ManifestError";
  }
}

const IDENTIFIER_PATTERN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;

const assertIdentifier = (kind: string, value: string) => {
  if (!IDENTIFIER_PATTERN.test(value)) {
    throw new ManifestError(`${kind} "${value}" is not a stable lowercase identifier.`);
  }
};

const assertUnique = (kind: string, values: readonly string[]) => {
  const seen = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      throw new ManifestError(`duplicate ${kind} "${value}".`);
    }
    seen.add(value);
  }
};

const normalizeRelativeRoutePath = (value: string) => {
  const path = value.trim();
  if (path === "") return "";
  if (
    path.startsWith("/") ||
    path.endsWith("/") ||
    path.includes("//") ||
    path.includes("\\") ||
    path.includes("?") ||
    path.includes("#")
  ) {
    throw new ManifestError(`route path "${value}" must be a normalized relative path.`);
  }

  const segments = path.split("/");
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new ManifestError(`route path "${value}" cannot contain dot segments.`);
  }
  if (segments[0] === "panel") {
    throw new ManifestError(`route path "${value}" cannot repeat the router basename.`);
  }

  return path;
};

const validateModule = (module: ProductModule | DevtoolModule) => {
  assertIdentifier("module id", module.id);

  for (const route of module.routes) {
    assertIdentifier("route id", route.id);
    normalizeRelativeRoutePath(route.path);
    if (!route.titleKey.trim()) {
      throw new ManifestError(`route "${route.id}" requires a title key.`);
    }
    for (const breadcrumb of route.breadcrumbs) {
      if (!breadcrumb.labelKey.trim()) {
        throw new ManifestError(`route "${route.id}" has an empty breadcrumb label key.`);
      }
    }
    if (route.access.audience === "guest" && route.access.roles?.length) {
      throw new ManifestError(`guest route "${route.id}" cannot require roles.`);
    }
  }

  for (const navigation of module.navigation) {
    assertIdentifier("navigation id", navigation.id);
    if (!navigation.labelKey.trim()) {
      throw new ManifestError(`navigation "${navigation.id}" requires a label key.`);
    }
    if (navigation.icon !== undefined && !navigation.icon.trim()) {
      throw new ManifestError(`navigation "${navigation.id}" has an empty icon.`);
    }
    if (!Number.isInteger(navigation.order) || navigation.order < 0) {
      throw new ManifestError(`navigation "${navigation.id}" requires a non-negative order.`);
    }
    if ((navigation.inert === true) === Boolean(navigation.routeId)) {
      throw new ManifestError(
        `navigation "${navigation.id}" must be either inert or reference one route.`,
      );
    }
    if (navigation.routeId && navigation.roles?.length) {
      throw new ManifestError(
        `navigation "${navigation.id}" must derive roles from its route instead of repeating them.`,
      );
    }
    if (module.kind === "product" && navigation.section === "developer") {
      throw new ManifestError(`product navigation "${navigation.id}" cannot be developer-only.`);
    }
    if (module.kind === "devtool" && navigation.section !== "developer") {
      throw new ManifestError(`devtool navigation "${navigation.id}" must use its own section.`);
    }
  }
};

const compose = (
  modules: readonly ProductModule[],
  devtools: readonly DevtoolModule[],
): Omit<DevelopmentManifest, "kind"> => {
  const allModules: readonly (ProductModule | DevtoolModule)[] = [...modules, ...devtools];

  for (const module of allModules) validateModule(module);

  assertUnique(
    "module id",
    allModules.map((module) => module.id),
  );

  const routes = allModules.flatMap((module) =>
    module.routes.map((route) => Object.freeze({ ...route, moduleId: module.id })),
  );
  const navigation = allModules
    .flatMap((module) =>
      module.navigation.map((item) => Object.freeze({ ...item, moduleId: module.id })),
    )
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
  assertUnique(
    "route id",
    routes.map((route) => route.id),
  );
  assertUnique(
    "route path",
    routes.map((route) => normalizeRelativeRoutePath(route.path)),
  );
  assertUnique(
    "navigation id",
    navigation.map((item) => item.id),
  );

  const routeIds = new Set(routes.map((route) => route.id));
  for (const item of navigation) {
    if (item.routeId && !routeIds.has(item.routeId)) {
      throw new ManifestError(
        `navigation "${item.id}" references unknown route "${item.routeId}".`,
      );
    }
  }
  for (const route of routes) {
    for (const breadcrumb of route.breadcrumbs) {
      if (breadcrumb.routeId && !routeIds.has(breadcrumb.routeId)) {
        throw new ManifestError(
          `route "${route.id}" breadcrumb references unknown route "${breadcrumb.routeId}".`,
        );
      }
    }
  }

  return Object.freeze({
    devtools: Object.freeze([...devtools]),
    modules: Object.freeze([...modules]),
    navigation: Object.freeze(navigation),
    routes: Object.freeze(routes),
  });
};

export const defineProductModule = (module: ProductModule) => Object.freeze(module);
export const defineDevtoolModule = (module: DevtoolModule) => Object.freeze(module);

export const adaptLegacyShellModule = (module: Omit<ProductModule, "kind">): ProductModule =>
  defineProductModule({ ...module, kind: "product" });

export const createProductManifest = (modules: readonly ProductModule[]): ProductManifest => {
  if (modules.some((module) => module.kind !== "product")) {
    throw new ManifestError("devtools cannot enter the product manifest.");
  }

  const composed = compose(modules, []);
  return Object.freeze({ ...composed, devtools: Object.freeze([]), kind: "product" });
};

export const createDevelopmentManifest = (
  modules: readonly ProductModule[],
  devtools: readonly DevtoolModule[],
): DevelopmentManifest => {
  if (devtools.some((module) => module.kind !== "devtool")) {
    throw new ManifestError("the optional devtool list accepts devtool modules only.");
  }

  return Object.freeze({ ...compose(modules, devtools), kind: "development" });
};

type RegistryManifest = ProductManifest | DevelopmentManifest;

const matchesAccess = (access: AccessContribution, actor: ManifestActor) => {
  if ((access.audience === "authenticated") !== actor.authenticated) return false;
  return !access.roles?.length || access.roles.some((role) => actor.roles.includes(role));
};

export const visibleManifestRoutes = (manifest: RegistryManifest, actor: ManifestActor) =>
  manifest.routes.filter((route) => matchesAccess(route.access, actor));

export const visibleManifestNavigation = (manifest: RegistryManifest, actor: ManifestActor) => {
  const routes = new Map(manifest.routes.map((route) => [route.id, route]));
  return manifest.navigation.filter((item) => {
    if (item.routeId) {
      const route = routes.get(item.routeId);
      return route ? matchesAccess(route.access, actor) : false;
    }
    return (
      item.inert === true &&
      actor.authenticated &&
      (!item.roles?.length || item.roles.some((role) => actor.roles.includes(role)))
    );
  });
};

export const manifestRouteHref = (routerBase: string, route: Pick<RouteContribution, "path">) =>
  joinPath(normalizeRouterBase(routerBase), route.path);
