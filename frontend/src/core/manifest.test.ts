import { describe, expect, it } from "vitest";
import {
  ManifestError,
  adaptLegacyShellModule,
  createDevelopmentManifest,
  createProductManifest,
  defineDevtoolModule,
  defineProductModule,
} from ".";
import type { NavigationContribution, ProductModule, RouteContribution } from ".";

const FixtureView = () => null;
const loadView = async () => ({ default: FixtureView });

const route = (
  id: string,
  path: string,
  roles: readonly string[] = ["opaque-role-from-adapter"],
): RouteContribution => ({
  access: { audience: "authenticated", roles },
  breadcrumbs: [],
  id,
  load: loadView,
  path,
  titleKey: `routes.${id}`,
});

const navigation = (id: string, routeId: string): NavigationContribution => ({
  id,
  labelKey: `navigation.${id}`,
  order: 10,
  routeId,
  section: "product",
});

const productModule = (id: string, routes: readonly RouteContribution[] = []) =>
  defineProductModule({ id, kind: "product", navigation: [], routes });

describe("platform manifest", () => {
  it("composes relative product contributions and preserves opaque role strings", () => {
    const dashboardRoute = route("home", "", ["role-defined-outside-core"]);
    const module = defineProductModule({
      id: "product-shell",
      kind: "product",
      navigation: [navigation("home-link", dashboardRoute.id)],
      routes: [dashboardRoute],
    });

    const manifest = createProductManifest([module]);

    expect(manifest.kind).toBe("product");
    expect(manifest.devtools).toEqual([]);
    expect(manifest.routes[0].moduleId).toBe("product-shell");
    expect(manifest.routes[0].access.roles).toEqual(["role-defined-outside-core"]);
  });

  it("supports an explicitly separate optional devtool manifest", () => {
    const devtool = defineDevtoolModule({
      id: "reference-tools",
      kind: "devtool",
      navigation: [
        {
          id: "reference-link",
          labelKey: "navigation.reference",
          order: 10,
          routeId: "reference-page",
          section: "developer",
        },
      ],
      routes: [route("reference-page", "dev/reference")],
    });

    const manifest = createDevelopmentManifest([productModule("product-shell")], [devtool]);

    expect(manifest.kind).toBe("development");
    expect(manifest.devtools).toEqual([devtool]);
  });

  it("rejects a devtool forced into the normal product manifest", () => {
    const devtool = defineDevtoolModule({
      id: "reference-tools",
      kind: "devtool",
      navigation: [],
      routes: [],
    });

    expect(() => createProductManifest([devtool as unknown as ProductModule])).toThrowError(
      /devtools cannot enter/,
    );
  });

  it.each([
    ["absolute", "/login", /normalized relative path/],
    ["duplicated basename", "panel/login", /cannot repeat the router basename/],
    ["dot segment", "system/../login", /dot segments/],
  ])("rejects %s route paths", (_label, path, message) => {
    expect(() =>
      createProductManifest([productModule("product-shell", [route("login", path)])]),
    ).toThrowError(message);
  });

  it.each([
    ["module ids", [productModule("duplicate"), productModule("duplicate")], /duplicate module id/],
    [
      "route ids",
      [
        productModule("first", [route("duplicate", "first")]),
        productModule("second", [route("duplicate", "second")]),
      ],
      /duplicate route id/,
    ],
    [
      "route paths",
      [
        productModule("first", [route("first", "same")]),
        productModule("second", [route("second", "same")]),
      ],
      /duplicate route path/,
    ],
  ])("rejects duplicate %s", (_label, modules, message) => {
    expect(() => createProductManifest(modules)).toThrowError(message);
  });

  it("rejects navigation that does not resolve to a contributed route", () => {
    const module = defineProductModule({
      id: "product-shell",
      kind: "product",
      navigation: [navigation("missing-link", "missing-route")],
      routes: [],
    });

    expect(() => createProductManifest([module])).toThrowError(/references unknown route/);
  });

  it("rejects breadcrumb targets that do not resolve to a contributed route", () => {
    const invalidRoute = {
      ...route("detail", "detail"),
      breadcrumbs: [{ labelKey: "breadcrumbs.missing", routeId: "missing-route" }],
    };

    expect(() =>
      createProductManifest([productModule("product-shell", [invalidRoute])]),
    ).toThrowError(/breadcrumb references unknown route/);
  });

  it("rejects repeated roles on navigable items and sorts navigation by placement order", () => {
    const home = route("home", "home");
    const invalid = defineProductModule({
      id: "invalid-navigation",
      kind: "product",
      navigation: [{ ...navigation("home-link", home.id), roles: ["admin"] }],
      routes: [home],
    });
    expect(() => createProductManifest([invalid])).toThrowError(/derive roles from its route/);

    const ordered = defineProductModule({
      id: "ordered-navigation",
      kind: "product",
      navigation: [
        { ...navigation("later", home.id), order: 20 },
        { ...navigation("earlier", home.id), order: 10 },
      ],
      routes: [home],
    });
    expect(createProductManifest([ordered]).navigation.map((item) => item.id)).toEqual([
      "earlier",
      "later",
    ]);
  });

  it("keeps inert future slots non-navigable", () => {
    const module = defineProductModule({
      id: "product-shell",
      kind: "product",
      navigation: [
        {
          id: "future-slot",
          inert: true,
          labelKey: "navigation.future",
          order: 10,
          section: "system",
        },
      ],
      routes: [],
    });

    const item = createProductManifest([module]).navigation[0];
    expect(item.inert).toBe(true);
    expect(item.routeId).toBeUndefined();
  });

  it("rejects empty optional navigation icons", () => {
    const home = route("home", "home");
    const module = defineProductModule({
      id: "product-shell",
      kind: "product",
      navigation: [{ ...navigation("home-link", home.id), icon: " " }],
      routes: [home],
    });

    expect(() => createProductManifest([module])).toThrowError(/empty icon/);
  });

  it("adapts only already-normalized legacy shell contributions", () => {
    const module = adaptLegacyShellModule({
      id: "legacy-shell-transition",
      navigation: [],
      routes: [route("legacy-home", "legacy-home")],
    });

    expect(createProductManifest([module]).modules[0].kind).toBe("product");
    expect(() =>
      createProductManifest([
        adaptLegacyShellModule({
          id: "invalid-transition",
          navigation: [],
          routes: [route("legacy-panel", "/panel/dashboard")],
        }),
      ]),
    ).toThrowError(ManifestError);
  });
});
