import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import withRouter from "../Components/Common/withRouter";

//import Components
import Header from "./Header";
import Sidebar from "./Sidebar";
import Footer from "./Footer";
import RightSidebar from "../Components/Common/RightSidebar";

//import actions
import {
  changeLayout,
  changeSidebarTheme,
  changeLayoutMode,
  changeLayoutWidth,
  changeLayoutPosition,
  changeTopbarTheme,
  changeLeftsidebarSizeType,
  changeLeftsidebarViewType,
  changeSidebarImageType,
  changeSidebarVisibility,
} from "../slices/layouts/thunk";

//redux
import { useSelector, useDispatch } from "react-redux";
import { createSelector } from "reselect";
import { ShellAuthProvider, useShellAuth } from "./ShellAuthContext";
import { NavigationMenuProvider } from "./LayoutMenuData";

const PanelCustomizer = () => {
  const { userProfile } = useShellAuth();
  const owner = userProfile ? String(userProfile.public_id ?? userProfile.id) : undefined;
  return <RightSidebar key={owner ?? "guest"} ownerKey={owner} />;
};

const selectLayoutProperties = createSelector(
  (state: any) => state.Layout,
  (layout) => ({
    layoutType: layout.layoutType,
    leftSidebarType: layout.leftSidebarType,
    layoutModeType: layout.layoutModeType,
    layoutWidthType: layout.layoutWidthType,
    layoutPositionType: layout.layoutPositionType,
    topbarThemeType: layout.topbarThemeType,
    leftsidbarSizeType: layout.leftsidbarSizeType,
    leftSidebarViewType: layout.leftSidebarViewType,
    leftSidebarImageType: layout.leftSidebarImageType,
    preloader: layout.preloader,
    sidebarVisibilitytype: layout.sidebarVisibilitytype,
  }),
);

const LayoutContent = (props: any) => {
  const [headerClass, setHeaderClass] = useState<any>("");
  const dispatch: any = useDispatch();

  // Inside your component
  const {
    layoutType,
    leftSidebarType,
    layoutModeType,
    layoutWidthType,
    layoutPositionType,
    topbarThemeType,
    leftsidbarSizeType,
    leftSidebarViewType,
    leftSidebarImageType,
    sidebarVisibilitytype,
  } = useSelector(selectLayoutProperties);

  /*
    layout settings
    */
  useEffect(() => {
    if (
      layoutType ||
      leftSidebarType ||
      layoutModeType ||
      layoutWidthType ||
      layoutPositionType ||
      topbarThemeType ||
      leftsidbarSizeType ||
      leftSidebarViewType ||
      leftSidebarImageType ||
      sidebarVisibilitytype
    ) {
      if (typeof window !== "undefined") window.dispatchEvent(new Event("resize"));
      dispatch(changeLeftsidebarViewType(leftSidebarViewType));
      dispatch(changeLeftsidebarSizeType(leftsidbarSizeType));
      dispatch(changeSidebarTheme(leftSidebarType));
      dispatch(changeLayoutMode(layoutModeType));
      dispatch(changeLayoutWidth(layoutWidthType));
      dispatch(changeLayoutPosition(layoutPositionType));
      dispatch(changeTopbarTheme(topbarThemeType));
      dispatch(changeLayout(layoutType));
      dispatch(changeSidebarImageType(leftSidebarImageType));
      dispatch(changeSidebarVisibility(sidebarVisibilitytype));
    }
  }, [
    layoutType,
    leftSidebarType,
    layoutModeType,
    layoutWidthType,
    layoutPositionType,
    topbarThemeType,
    leftsidbarSizeType,
    leftSidebarViewType,
    leftSidebarImageType,
    sidebarVisibilitytype,
    dispatch,
  ]);
  /*
    call dark/light mode
    */
  const onChangeLayoutMode = (value: any) => {
    if (changeLayoutMode) {
      dispatch(changeLayoutMode(value));
    }
  };

  // class add remove in header
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return undefined;

    const scrollNavigation = () => {
      const scrollup = document.documentElement.scrollTop;
      setHeaderClass(scrollup > 50 ? "topbar-shadow" : "");
    };

    scrollNavigation();
    window.addEventListener("scroll", scrollNavigation, { passive: true });
    return () => window.removeEventListener("scroll", scrollNavigation);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const humberIcon = document.querySelector<HTMLElement>(".hamburger-icon");
    if (!humberIcon) return;
    if (
      sidebarVisibilitytype === "show" ||
      layoutType === "vertical" ||
      layoutType === "twocolumn"
    ) {
      humberIcon.classList.remove("open");
    } else {
      humberIcon.classList.add("open");
    }
  }, [sidebarVisibilitytype, layoutType]);

  return (
    <React.Fragment>
      <div id="layout-wrapper">
        <NavigationMenuProvider>
          <Header
            headerClass={headerClass}
            layoutModeType={layoutModeType}
            onChangeLayoutMode={onChangeLayoutMode}
          />
          <Sidebar layoutType={layoutType} />
        </NavigationMenuProvider>
        <div className="main-content">
          {props.children}
          <Footer />
        </div>
      </div>
      <PanelCustomizer />
    </React.Fragment>
  );
};

const Layout = (props: any) => (
  <ShellAuthProvider>
    <LayoutContent {...props} />
  </ShellAuthProvider>
);

Layout.propTypes = {
  children: PropTypes.object,
};

export default withRouter(Layout);
