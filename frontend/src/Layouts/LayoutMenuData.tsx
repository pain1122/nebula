import React, { createContext, lazy, Suspense, useContext, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { adminCapabilitiesFor } from "../modules/checkupino/auth/capabilities";
import { createProductAdminMenuItems, productMenuLinkActive } from "../panel/menu";
import { useShellAuth } from "./ShellAuthContext";

export type NavigationMenuItem = {
  readonly active?: boolean;
  readonly product?: boolean;
  readonly badgeColor?: string;
  readonly badgeName?: string;
  readonly childItems?: readonly NavigationMenuItem[];
  readonly click?: (event: React.MouseEvent<HTMLElement>) => void;
  readonly icon?: string;
  readonly id?: string | number;
  readonly isChildItem?: boolean;
  readonly isHeader?: boolean;
  readonly label: string;
  readonly link?: string;
  readonly parentId?: string;
  readonly stateVariables?: boolean;
  readonly subItems?: readonly NavigationMenuItem[];
};

const defaultProductMenuItems = createProductAdminMenuItems({
  authenticated: true,
  roles: ["admin"],
}) as readonly NavigationMenuItem[];

export const NavigationMenuContext =
  createContext<readonly NavigationMenuItem[]>(defaultProductMenuItems);

const LazyDevToolboxNavigationData = lazy(() => import("../devtools/ToolboxNavigationData"));

export const NavigationMenuProvider = ({ children }: React.PropsWithChildren) => {
  const history = useNavigate();
  const location = useLocation();
  const locationKey = location.pathname + location.search;
  const [expanded, setExpanded] = useState<{ location: string; values: Record<string, boolean> }>({
    location: "",
    values: {},
  });
  const { userProfile } = useShellAuth();
  const productMenuItems: readonly NavigationMenuItem[] = createProductAdminMenuItems({
    authenticated: Boolean(userProfile),
    roles: userProfile?.roles ?? [],
  }).map((item) => {
    const subItems = item.subItems?.map((child) => ({
      ...child,
      active: productMenuLinkActive(child.link, location.pathname, location.search),
    }));
    const active =
      subItems?.some((child) => child.active) ??
      productMenuLinkActive(item.link, location.pathname, location.search);
    if (!subItems) return { ...item, active };
    const id = item.id!;
    const open = expanded.location === locationKey ? (expanded.values[id] ?? active) : active;
    return {
      ...item,
      subItems,
      active,
      stateVariables: open,
      click: (event: React.MouseEvent<HTMLElement>) => {
        event.preventDefault();
        setExpanded((current) => ({
          location: locationKey,
          values: { ...(current.location === locationKey ? current.values : {}), [id]: !open },
        }));
      },
    };
  });
  const isRootAdmin = adminCapabilitiesFor(userProfile).accessDeveloperTools;

  if (!isRootAdmin) {
    return (
      <NavigationMenuContext.Provider value={productMenuItems}>
        {children}
      </NavigationMenuContext.Provider>
    );
  }

  const productFallback = (
    <NavigationMenuContext.Provider value={productMenuItems}>
      {children}
    </NavigationMenuContext.Provider>
  );

  return (
    <Suspense fallback={productFallback}>
      <LazyDevToolboxNavigationData history={history} productMenuItems={productMenuItems}>
        {children}
      </LazyDevToolboxNavigationData>
    </Suspense>
  );
};

export const useNavigationMenu = () => useContext(NavigationMenuContext);
