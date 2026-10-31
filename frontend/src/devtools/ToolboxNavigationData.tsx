import { useMemo } from "react";
import type { NavigateFunction, NavigateOptions, To } from "react-router-dom";

import {
  NavigationMenuContext,
  type NavigationMenuItem,
} from "../Layouts/LayoutMenuData";
import { useDevToolboxMenu } from "./toolboxMenu";
import { fromLegacyDevToolboxPath } from "./toolboxContract";

type ToolboxNavigationDataProps = React.PropsWithChildren<{
  readonly history: NavigateFunction;
  readonly productMenuItems: readonly NavigationMenuItem[];
}>;

const adaptMenuItem = (item: NavigationMenuItem): NavigationMenuItem => ({
  ...item,
  childItems: item.childItems?.map(adaptMenuItem),
  link: fromLegacyDevToolboxPath(item.link),
  subItems: item.subItems?.map(adaptMenuItem),
});

const createLegacyNavigateAdapter = (navigate: NavigateFunction): NavigateFunction => {
  function adaptedNavigate(to: To, options?: NavigateOptions): void | Promise<void>;
  function adaptedNavigate(delta: number): void | Promise<void>;
  function adaptedNavigate(
    destination: To | number,
    options?: NavigateOptions,
  ): void | Promise<void> {
    if (typeof destination === "number") return navigate(destination);

    if (typeof destination === "string") {
      const path =
        destination === "/dashboard"
          ? "/"
          : (fromLegacyDevToolboxPath(destination) ?? destination);
      return navigate(path, options);
    }

    const pathname = fromLegacyDevToolboxPath(destination.pathname);
    return navigate(pathname ? { ...destination, pathname } : destination, options);
  }

  return adaptedNavigate;
};

const ToolboxNavigationData = ({
  children,
  history,
  productMenuItems,
}: ToolboxNavigationDataProps) => {
  const legacyHistory = useMemo(() => createLegacyNavigateAdapter(history), [history]);
  const toolboxMenuItems = useDevToolboxMenu({
    history: legacyHistory,
    isRootAdmin: true,
  }) as NavigationMenuItem[];
  const adaptedToolboxMenuItems = toolboxMenuItems.map(adaptMenuItem);

  return (
    <NavigationMenuContext.Provider value={[...productMenuItems, ...adaptedToolboxMenuItems]}>
      {children}
    </NavigationMenuContext.Provider>
  );
};

export default ToolboxNavigationData;
