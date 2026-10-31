import { renderHook } from "@testing-library/react";
import type { NavigateFunction } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { rootAdminOnly } from "../Routes/routeTypes";
import {
  DEV_TOOLBOX_BASE_PATH,
  DEV_TOOLBOX_COMPATIBILITY_ALIASES,
  fromLegacyDevToolboxPath,
} from "./toolboxContract";
import { useDevToolboxMenu } from "./toolboxMenu";
import { rootAdminToolboxRoutes } from "./toolboxRoutes";

type MenuItem = {
  readonly childItems?: readonly MenuItem[];
  readonly link?: string;
  readonly subItems?: readonly MenuItem[];
};

const collectLinks = (items: readonly MenuItem[]): string[] =>
  items.flatMap((item) => [
    ...(item.link ? [item.link] : []),
    ...collectLinks(item.subItems ?? []),
    ...collectLinks(item.childItems ?? []),
  ]);

describe("active role-derived toolbox navigation", () => {
  it("keeps the toolbox absent for ordinary admins and prefixes it for root admins", () => {
    const history = (() => undefined) as NavigateFunction;
    const { result, rerender } = renderHook(
      ({ isRootAdmin }) => useDevToolboxMenu({ history, isRootAdmin }),
      { initialProps: { isRootAdmin: false } },
    );

    expect(result.current).toEqual([]);

    rerender({ isRootAdmin: true });

    expect(result.current[0]).toMatchObject({
      isHeader: true,
      label: "Developer Toolbox",
    });
    expect(fromLegacyDevToolboxPath(result.current[1].subItems[0].link)).toBe(
      "/dev/dashboard-analytics",
    );
  });

  it("keeps every retained demo route root-only and represented in the toolbox menu", () => {
    const history = (() => undefined) as NavigateFunction;
    const { result } = renderHook(() => useDevToolboxMenu({ history, isRootAdmin: true }));
    const menuLinks = collectLinks(result.current)
      .map((link) => fromLegacyDevToolboxPath(link))
      .filter((link): link is string => Boolean(link?.startsWith(`${DEV_TOOLBOX_BASE_PATH}/`)));
    const routePaths = rootAdminToolboxRoutes.map((route) => route.path);
    const menuOwnedRoutePaths = routePaths.filter(
      (path) =>
        path !== DEV_TOOLBOX_BASE_PATH &&
        !DEV_TOOLBOX_COMPATIBILITY_ALIASES.includes(
          path as (typeof DEV_TOOLBOX_COMPATIBILITY_ALIASES)[number],
        ),
    );

    expect(new Set(menuLinks).size).toBe(menuLinks.length);
    expect(new Set(menuLinks)).toEqual(new Set(menuOwnedRoutePaths));
    expect(rootAdminToolboxRoutes.every((route) => route.allowedRoles === rootAdminOnly)).toBe(
      true,
    );
  });
});
