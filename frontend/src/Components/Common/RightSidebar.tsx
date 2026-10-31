import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Offcanvas, OffcanvasHeader, OffcanvasBody, Collapse } from "reactstrap";
import withRouter from "./withRouter";

//redux
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
  changePreLoader,
  changeSidebarVisibility,
  // resetValue
} from "../../slices/layouts/thunk";

import { useSelector, useDispatch } from "react-redux";

//import Constant
import {
  LAYOUT_TYPES,
  LAYOUT_SIDEBAR_TYPES,
  LAYOUT_MODE_TYPES,
  LAYOUT_WIDTH_TYPES,
  LAYOUT_POSITION_TYPES,
  LAYOUT_TOPBAR_THEME_TYPES,
  LEFT_SIDEBAR_SIZE_TYPES,
  LEFT_SIDEBAR_VIEW_TYPES,
  LEFT_SIDEBAR_IMAGE_TYPES,
  PERLOADER_TYPES,
  SIDEBAR_VISIBILITY_TYPES,
} from "../constants/layout";

//SimpleBar
import SimpleBar from "simplebar-react";
import classnames from "classnames";
import { shellAssets } from "../../Layouts/shellAssets";
import { createSelector } from "reselect";
import {
  shouldIntroduceCustomizer,
  markCustomizerIntroduced,
} from "../../modules/checkupino/preferences/customizer";

const RightSidebar = (props: any) => {
  const { t } = useTranslation();
  const dispatch: any = useDispatch();

  const [show, setShow] = useState<boolean>(false);

  function tog_show() {
    setShow(!show);
    dispatch(changeSidebarTheme("gradient"));
  }

  useEffect(() => {
    if (typeof document === "undefined") return;
    const sidebarColorDark = document.getElementById("sidebar-color-dark") as HTMLInputElement;
    const sidebarColorLight = document.getElementById("sidebar-color-light") as HTMLInputElement;

    if (show && sidebarColorDark && sidebarColorLight) {
      sidebarColorDark.checked = false;
      sidebarColorLight.checked = false;
    }
  }, [show]);

  const selectLayoutState = (state: any) => state.Layout;
  const selectLayoutProperties = createSelector(selectLayoutState, (layout) => ({
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
  }));
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
    preloader,
    sidebarVisibilitytype,
  } = useSelector(selectLayoutProperties);

  // open offcanvas
  const [open, setOpen] = useState<boolean>(() => shouldIntroduceCustomizer(props.ownerKey));
  useEffect(() => {
    if (open) markCustomizerIntroduced(props.ownerKey);
  }, [open, props.ownerKey]);
  const toggleLeftCanvas = () => {
    setOpen(!open);
  };

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return undefined;

    const scrollFunction = () => {
      const element = document.getElementById("back-to-top");
      if (element) {
        element.style.display =
          document.body.scrollTop > 100 || document.documentElement.scrollTop > 100
            ? "block"
            : "none";
      }
    };

    scrollFunction();
    window.addEventListener("scroll", scrollFunction, { passive: true });
    return () => window.removeEventListener("scroll", scrollFunction);
  }, []);

  const toTop = () => {
    if (typeof document === "undefined") return;
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
  };

  const pathName = props.router.location.pathname;

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const preloader = document.getElementById("preloader") as HTMLElement;

    if (preloader) {
      preloader.style.opacity = "1";
      preloader.style.visibility = "visible";

      const timeout = window.setTimeout(function () {
        preloader.style.opacity = "0";
        preloader.style.visibility = "hidden";
      }, 1000);
      return () => window.clearTimeout(timeout);
    }
    return undefined;
  }, [pathName]);

  return (
    <React.Fragment>
      <button
        aria-label={t("product.customizer.backToTop")}
        onClick={() => toTop()}
        className="btn btn-danger btn-icon"
        id="back-to-top"
      >
        <i className="ri-arrow-up-line"></i>
      </button>

      {preloader === "enable" && (
        <div id="preloader">
          <div id="status">
            <output className="spinner-border text-primary avatar-sm">
              <span className="visually-hidden">{t("product.customizer.loading")}</span>
            </output>
          </div>
        </div>
      )}

      <div>
        <div className="customizer-setting">
          <button
            type="button"
            aria-label={t("product.customizer.title")}
            aria-expanded={open}
            onClick={toggleLeftCanvas}
            className="btn-info rounded-pill shadow-lg btn btn-icon btn-lg p-2 rounded-pill"
          >
            <i className="mdi mdi-spin mdi-cog-outline fs-22"></i>
          </button>
        </div>
        <Offcanvas isOpen={open} toggle={toggleLeftCanvas} direction="end">
          <OffcanvasHeader
            className="d-flex align-items-center bg-primary bg-gradient p-3 offcanvas-header-dark"
            toggle={toggleLeftCanvas}
          >
            <span className="m-0 me-2 text-white">{t("product.customizer.title")}</span>
          </OffcanvasHeader>
          <OffcanvasBody className="p-0">
            <SimpleBar className="h-100">
              <div className="p-4">
                <h6 className="mb-0 fw-semibold text-uppercase">
                  {t("product.customizer.layout")}
                </h6>
                <p className="text-muted">{t("product.customizer.chooseLayout")}</p>

                <div className="row gy-3">
                  <div className="col-4">
                    <div className="form-check card-radio">
                      <input
                        id="customizer-layout01"
                        name="data-layout"
                        type="radio"
                        value={LAYOUT_TYPES.VERTICAL}
                        checked={layoutType === LAYOUT_TYPES.VERTICAL}
                        onChange={(e) => {
                          if (e.target.checked) {
                            dispatch(changeLayout(e.target.value));
                          }
                        }}
                        className="form-check-input"
                      />
                      <label
                        className="form-check-label p-0 avatar-md w-100"
                        htmlFor="customizer-layout01"
                        aria-label={t("product.customizer.vertical")}
                      >
                        <span className="d-flex gap-1 h-100">
                          <span className="flex-shrink-0">
                            <span className="bg-light d-flex h-100 flex-column gap-1 p-1">
                              <span className="d-block p-1 px-2 bg-primary-subtle rounded mb-2"></span>
                              <span className="d-block p-1 px-2 pb-0 bg-primary-subtle"></span>
                              <span className="d-block p-1 px-2 pb-0 bg-primary-subtle"></span>
                              <span className="d-block p-1 px-2 pb-0 bg-primary-subtle"></span>
                            </span>
                          </span>
                          <span className="flex-grow-1">
                            <span className="d-flex h-100 flex-column">
                              <span className="bg-light d-block p-1"></span>
                              <span className="bg-light d-block p-1 mt-auto"></span>
                            </span>
                          </span>
                        </span>
                      </label>
                    </div>
                    <h5 className="fs-13 text-center mt-2">{t("product.customizer.vertical")}</h5>
                  </div>
                  <div className="col-4">
                    <div className="form-check card-radio">
                      <input
                        id="customizer-layout02"
                        name="data-layout"
                        type="radio"
                        value={LAYOUT_TYPES.HORIZONTAL}
                        checked={layoutType === LAYOUT_TYPES.HORIZONTAL}
                        onChange={(e) => {
                          if (e.target.checked) {
                            dispatch(changeLayout(e.target.value));
                          }
                        }}
                        className="form-check-input"
                      />
                      <label
                        className="form-check-label p-0 avatar-md w-100"
                        htmlFor="customizer-layout02"
                        aria-label={t("product.customizer.horizontal")}
                      >
                        <span className="d-flex h-100 flex-column gap-1">
                          <span className="bg-light d-flex p-1 gap-1 align-items-center">
                            <span className="d-block p-1 bg-primary-subtle rounded me-1"></span>
                            <span className="d-block p-1 pb-0 px-2 bg-primary-subtle ms-auto"></span>
                            <span className="d-block p-1 pb-0 px-2 bg-primary-subtle"></span>
                          </span>
                          <span className="bg-light d-block p-1"></span>
                          <span className="bg-light d-block p-1 mt-auto"></span>
                        </span>
                      </label>
                    </div>
                    <h5 className="fs-13 text-center mt-2">{t("product.customizer.horizontal")}</h5>
                  </div>
                  <div className="col-4">
                    <div className="form-check card-radio">
                      <input
                        id="customizer-layout03"
                        name="data-layout"
                        type="radio"
                        value={LAYOUT_TYPES.TWOCOLUMN}
                        checked={layoutType === LAYOUT_TYPES.TWOCOLUMN}
                        onChange={(e) => {
                          if (e.target.checked) {
                            dispatch(changeLayout(e.target.value));
                          }
                        }}
                        className="form-check-input"
                      />
                      <label
                        className="form-check-label p-0 avatar-md w-100"
                        htmlFor="customizer-layout03"
                        aria-label={t("product.customizer.twoColumn")}
                      >
                        <span className="d-flex gap-1 h-100">
                          <span className="flex-shrink-0">
                            <span className="bg-light d-flex h-100 flex-column gap-1">
                              <span className="d-block p-1 bg-primary-subtle mb-2"></span>
                              <span className="d-block p-1 pb-0 bg-primary-subtle"></span>
                              <span className="d-block p-1 pb-0 bg-primary-subtle"></span>
                              <span className="d-block p-1 pb-0 bg-primary-subtle"></span>
                            </span>
                          </span>
                          <span className="flex-shrink-0">
                            <span className="bg-light d-flex h-100 flex-column gap-1 p-1">
                              <span className="d-block p-1 px-2 pb-0 bg-primary-subtle"></span>
                              <span className="d-block p-1 px-2 pb-0 bg-primary-subtle"></span>
                              <span className="d-block p-1 px-2 pb-0 bg-primary-subtle"></span>
                              <span className="d-block p-1 px-2 pb-0 bg-primary-subtle"></span>
                            </span>
                          </span>
                          <span className="flex-grow-1">
                            <span className="d-flex h-100 flex-column">
                              <span className="bg-light d-block p-1"></span>
                              <span className="bg-light d-block p-1 mt-auto"></span>
                            </span>
                          </span>
                        </span>
                      </label>
                    </div>
                    <h5 className="fs-13 text-center mt-2">{t("product.customizer.twoColumn")}</h5>
                  </div>
                  <div className="col-4">
                    <div className="form-check card-radio">
                      <input
                        id="customizer-layout04"
                        name="data-layout"
                        type="radio"
                        className="form-check-input"
                        value={LAYOUT_TYPES.SEMIBOX}
                        checked={layoutType === LAYOUT_TYPES.SEMIBOX}
                        onChange={(e) => {
                          if (e.target.checked) {
                            dispatch(changeLayout(e.target.value));
                          }
                        }}
                      />
                      <label
                        className="form-check-label p-0 avatar-md w-100"
                        htmlFor="customizer-layout04"
                        aria-label={t("product.customizer.semiBox")}
                      >
                        <span className="d-flex gap-1 h-100">
                          <span className="flex-shrink-0 p-1">
                            <span className="bg-light d-flex h-100 flex-column gap-1 p-1">
                              <span className="d-block p-1 px-2 bg-primary-subtle rounded mb-2"></span>
                              <span className="d-block p-1 px-2 pb-0 bg-primary-subtle"></span>
                              <span className="d-block p-1 px-2 pb-0 bg-primary-subtle"></span>
                              <span className="d-block p-1 px-2 pb-0 bg-primary-subtle"></span>
                            </span>
                          </span>
                          <span className="flex-grow-1">
                            <span className="d-flex h-100 flex-column pt-1 pe-2">
                              <span className="bg-light d-block p-1"></span>
                              <span className="bg-light d-block p-1 mt-auto"></span>
                            </span>
                          </span>
                        </span>
                      </label>
                    </div>
                    <h5 className="fs-13 text-center mt-2">{t("product.customizer.semiBox")}</h5>
                  </div>
                </div>

                <h6 className="mt-4 mb-0 fw-semibold text-uppercase">
                  {t("product.customizer.colorScheme")}
                </h6>
                <p className="text-muted">{t("product.customizer.chooseColorScheme")}</p>

                <div className="colorscheme-cardradio">
                  <div className="row">
                    <div className="col-4">
                      <div className="form-check card-radio">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="data-bs-theme"
                          id="layout-mode-system"
                          value={LAYOUT_MODE_TYPES.SYSTEM}
                          checked={layoutModeType === LAYOUT_MODE_TYPES.SYSTEM}
                          onChange={(e) => {
                            if (e.target.checked) {
                              dispatch(changeLayoutMode(e.target.value));
                            }
                          }}
                        />
                        <label
                          className="form-check-label p-0 avatar-md w-100"
                          htmlFor="layout-mode-system"
                          aria-label={t("product.customizer.system")}
                        >
                          <span className="d-flex h-100 align-items-center justify-content-center bg-light">
                            <i className="ri-computer-line fs-2 text-primary"></i>
                          </span>
                        </label>
                      </div>
                      <h5 className="fs-13 text-center mt-2">{t("product.customizer.system")}</h5>
                    </div>

                    <div className="col-4">
                      <div className="form-check card-radio">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="data-bs-theme"
                          id="layout-mode-light"
                          value={LAYOUT_MODE_TYPES.LIGHTMODE}
                          checked={layoutModeType === LAYOUT_MODE_TYPES.LIGHTMODE}
                          onChange={(e) => {
                            if (e.target.checked) {
                              dispatch(changeLayoutMode(e.target.value));
                            }
                          }}
                        />
                        <label
                          className="form-check-label p-0 avatar-md w-100"
                          htmlFor="layout-mode-light"
                          aria-label={t("product.customizer.light")}
                        >
                          <span className="d-flex gap-1 h-100">
                            <span className="flex-shrink-0">
                              <span className="bg-light d-flex h-100 flex-column gap-1 p-1">
                                <span className="d-block p-1 px-2 bg-primary-subtle rounded mb-2"></span>
                                <span className="d-block p-1 px-2 pb-0 bg-primary-subtle"></span>
                                <span className="d-block p-1 px-2 pb-0 bg-primary-subtle"></span>
                                <span className="d-block p-1 px-2 pb-0 bg-primary-subtle"></span>
                              </span>
                            </span>
                            <span className="flex-grow-1">
                              <span className="d-flex h-100 flex-column">
                                <span className="bg-light d-block p-1"></span>
                                <span className="bg-light d-block p-1 mt-auto"></span>
                              </span>
                            </span>
                          </span>
                        </label>
                      </div>
                      <h5 className="fs-13 text-center mt-2">{t("product.customizer.light")}</h5>
                    </div>

                    <div className="col-4">
                      <div className="form-check card-radio dark">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="data-bs-theme"
                          id="layout-mode-dark"
                          value={LAYOUT_MODE_TYPES.DARKMODE}
                          checked={layoutModeType === LAYOUT_MODE_TYPES.DARKMODE}
                          onChange={(e) => {
                            if (e.target.checked) {
                              dispatch(changeLayoutMode(e.target.value));
                            }
                          }}
                        />
                        <label
                          className="form-check-label p-0 avatar-md w-100 bg-dark"
                          htmlFor="layout-mode-dark"
                          aria-label={t("product.customizer.dark")}
                        >
                          <span className="d-flex gap-1 h-100">
                            <span className="flex-shrink-0">
                              <span className="bg-white bg-opacity-10 d-flex h-100 flex-column gap-1 p-1">
                                <span className="d-block p-1 px-2 bg-white bg-opacity-10 rounded mb-2"></span>
                                <span className="d-block p-1 px-2 pb-0 bg-white bg-opacity-10"></span>
                                <span className="d-block p-1 px-2 pb-0 bg-white bg-opacity-10"></span>
                                <span className="d-block p-1 px-2 pb-0 bg-white bg-opacity-10"></span>
                              </span>
                            </span>
                            <span className="flex-grow-1">
                              <span className="d-flex h-100 flex-column">
                                <span className="bg-white bg-opacity-10 d-block p-1"></span>
                                <span className="bg-white bg-opacity-10 d-block p-1 mt-auto"></span>
                              </span>
                            </span>
                          </span>
                        </label>
                      </div>
                      <h5 className="fs-13 text-center mt-2">{t("product.customizer.dark")}</h5>
                    </div>
                  </div>
                </div>
                {layoutType === LAYOUT_TYPES.SEMIBOX && (
                  <div id="sidebar-visibility">
                    <h6 className="mt-4 mb-0 fw-semibold text-uppercase">
                      {t("product.customizer.sidebarVisibility")}
                    </h6>
                    <p className="text-muted">{t("product.customizer.chooseSidebarVisibility")}</p>

                    <div className="row">
                      <div className="col-4">
                        <div className="form-check card-radio">
                          <input
                            className="form-check-input"
                            type="radio"
                            name="data-sidebar-visibility"
                            id="sidebar-visibility-show"
                            value={SIDEBAR_VISIBILITY_TYPES.SHOW}
                            checked={sidebarVisibilitytype === SIDEBAR_VISIBILITY_TYPES.SHOW}
                            onChange={(e) => {
                              if (e.target.checked) {
                                dispatch(changeSidebarVisibility(e.target.value));
                              }
                            }}
                          />
                          <label
                            className="form-check-label p-0 avatar-md w-100"
                            htmlFor="sidebar-visibility-show"
                            aria-label={t("product.customizer.show")}
                          >
                            <span className="d-flex gap-1 h-100">
                              <span className="flex-shrink-0 p-1">
                                <span className="bg-light d-flex h-100 flex-column gap-1 p-1">
                                  <span className="d-block p-1 px-2 bg-primary-subtle rounded mb-2"></span>
                                  <span className="d-block p-1 px-2 pb-0 bg-primary-subtle"></span>
                                  <span className="d-block p-1 px-2 pb-0 bg-primary-subtle"></span>
                                  <span className="d-block p-1 px-2 pb-0 bg-primary-subtle"></span>
                                </span>
                              </span>
                              <span className="flex-grow-1">
                                <span className="d-flex h-100 flex-column pt-1 pe-2">
                                  <span className="bg-light d-block p-1"></span>
                                  <span className="bg-light d-block p-1 mt-auto"></span>
                                </span>
                              </span>
                            </span>
                          </label>
                        </div>
                        <h5 className="fs-13 text-center mt-2">{t("product.customizer.show")}</h5>
                      </div>
                      <div className="col-4">
                        <div className="form-check card-radio">
                          <input
                            className="form-check-input"
                            type="radio"
                            name="data-sidebar-visibility"
                            id="sidebar-visibility-hidden"
                            value={SIDEBAR_VISIBILITY_TYPES.HIDDEN}
                            checked={sidebarVisibilitytype === SIDEBAR_VISIBILITY_TYPES.HIDDEN}
                            onChange={(e) => {
                              if (e.target.checked) {
                                dispatch(changeSidebarVisibility(e.target.value));
                              }
                            }}
                          />
                          <label
                            className="form-check-label p-0 avatar-md w-100 px-2"
                            htmlFor="sidebar-visibility-hidden"
                            aria-label={t("product.customizer.hidden")}
                          >
                            <span className="d-flex gap-1 h-100">
                              <span className="flex-grow-1">
                                <span className="d-flex h-100 flex-column pt-1 px-2">
                                  <span className="bg-light d-block p-1"></span>
                                  <span className="bg-light d-block p-1 mt-auto"></span>
                                </span>
                              </span>
                            </span>
                          </label>
                        </div>
                        <h5 className="fs-13 text-center mt-2">{t("product.customizer.hidden")}</h5>
                      </div>
                    </div>
                  </div>
                )}
                {layoutType !== LAYOUT_TYPES.TWOCOLUMN && (
                  <React.Fragment>
                    {(layoutType === LAYOUT_TYPES.VERTICAL ||
                      layoutType === LAYOUT_TYPES.HORIZONTAL) && (
                      <div id="layout-width">
                        <h6 className="mt-4 mb-0 fw-semibold text-uppercase">
                          {t("product.customizer.layoutWidth")}
                        </h6>
                        <p className="text-muted">{t("product.customizer.chooseLayoutWidth")}</p>

                        <div className="row">
                          <div className="col-4">
                            <div className="form-check card-radio">
                              <input
                                className="form-check-input"
                                type="radio"
                                name="data-layout-width"
                                id="layout-width-fluid"
                                value={LAYOUT_WIDTH_TYPES.FLUID}
                                checked={layoutWidthType === LAYOUT_WIDTH_TYPES.FLUID}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    dispatch(changeLayoutWidth(e.target.value));
                                    dispatch(changeLeftsidebarSizeType("lg"));
                                  }
                                }}
                              />
                              <label
                                className="form-check-label p-0 avatar-md w-100"
                                htmlFor="layout-width-fluid"
                                aria-label={t("product.customizer.fluid")}
                              >
                                <span className="d-flex gap-1 h-100">
                                  <span className="flex-shrink-0">
                                    <span className="bg-light d-flex h-100 flex-column gap-1 p-1">
                                      <span className="d-block p-1 px-2 bg-primary-subtle rounded mb-2"></span>
                                      <span className="d-block p-1 px-2 pb-0 bg-primary-subtle"></span>
                                      <span className="d-block p-1 px-2 pb-0 bg-primary-subtle"></span>
                                      <span className="d-block p-1 px-2 pb-0 bg-primary-subtle"></span>
                                    </span>
                                  </span>
                                  <span className="flex-grow-1">
                                    <span className="d-flex h-100 flex-column">
                                      <span className="bg-light d-block p-1"></span>
                                      <span className="bg-light d-block p-1 mt-auto"></span>
                                    </span>
                                  </span>
                                </span>
                              </label>
                            </div>
                            <h5 className="fs-13 text-center mt-2">
                              {t("product.customizer.fluid")}
                            </h5>
                          </div>
                          <div className="col-4">
                            <div className="form-check card-radio">
                              <input
                                className="form-check-input"
                                type="radio"
                                name="data-layout-width"
                                id="layout-width-boxed"
                                value={LAYOUT_WIDTH_TYPES.BOXED}
                                checked={layoutWidthType === LAYOUT_WIDTH_TYPES.BOXED}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    dispatch(changeLayoutWidth(e.target.value));
                                    dispatch(changeLeftsidebarSizeType("sm-hover"));
                                  }
                                }}
                              />
                              <label
                                className="form-check-label p-0 avatar-md w-100 px-2"
                                htmlFor="layout-width-boxed"
                                aria-label={t("product.customizer.boxed")}
                              >
                                <span className="d-flex gap-1 h-100 border-start border-end">
                                  <span className="flex-shrink-0">
                                    <span className="bg-light d-flex h-100 flex-column gap-1 p-1">
                                      <span className="d-block p-1 px-2 bg-primary-subtle rounded mb-2"></span>
                                      <span className="d-block p-1 px-2 pb-0 bg-primary-subtle"></span>
                                      <span className="d-block p-1 px-2 pb-0 bg-primary-subtle"></span>
                                      <span className="d-block p-1 px-2 pb-0 bg-primary-subtle"></span>
                                    </span>
                                  </span>
                                  <span className="flex-grow-1">
                                    <span className="d-flex h-100 flex-column">
                                      <span className="bg-light d-block p-1"></span>
                                      <span className="bg-light d-block p-1 mt-auto"></span>
                                    </span>
                                  </span>
                                </span>
                              </label>
                            </div>
                            <h5 className="fs-13 text-center mt-2">
                              {t("product.customizer.boxed")}
                            </h5>
                          </div>
                        </div>
                      </div>
                    )}

                    <div id="layout-position">
                      <h6 className="mt-4 mb-0 fw-semibold text-uppercase">
                        {t("product.customizer.layoutPosition")}
                      </h6>
                      <p className="text-muted">{t("product.customizer.chooseLayoutPosition")}</p>

                      <fieldset
                        className="btn-group radio"
                        aria-label={t("product.customizer.layoutPosition")}
                      >
                        <input
                          type="radio"
                          className="btn-check"
                          name="data-layout-position"
                          id="layout-position-fixed"
                          value={LAYOUT_POSITION_TYPES.FIXED}
                          checked={layoutPositionType === LAYOUT_POSITION_TYPES.FIXED}
                          onChange={(e) => {
                            if (e.target.checked) {
                              dispatch(changeLayoutPosition(e.target.value));
                            }
                          }}
                        />
                        <label className="btn btn-light w-sm" htmlFor="layout-position-fixed">
                          {t("product.customizer.fixed")}
                        </label>

                        <input
                          type="radio"
                          className="btn-check"
                          name="data-layout-position"
                          id="layout-position-scrollable"
                          value={LAYOUT_POSITION_TYPES.SCROLLABLE}
                          checked={layoutPositionType === LAYOUT_POSITION_TYPES.SCROLLABLE}
                          onChange={(e) => {
                            if (e.target.checked) {
                              dispatch(changeLayoutPosition(e.target.value));
                            }
                          }}
                        />
                        <label
                          className="btn btn-light w-sm ms-0"
                          htmlFor="layout-position-scrollable"
                        >
                          {t("product.customizer.scrollable")}
                        </label>
                      </fieldset>
                    </div>
                  </React.Fragment>
                )}

                <h6 className="mt-4 mb-0 fw-semibold text-uppercase">
                  {t("product.customizer.topbarColor")}
                </h6>
                <p className="text-muted">{t("product.customizer.chooseTopbarColor")}</p>

                <div className="row">
                  <div className="col-4">
                    <div className="form-check card-radio">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="data-topbar"
                        id="topbar-color-light"
                        value={LAYOUT_TOPBAR_THEME_TYPES.LIGHT}
                        checked={topbarThemeType === LAYOUT_TOPBAR_THEME_TYPES.LIGHT}
                        onChange={(e) => {
                          if (e.target.checked) {
                            dispatch(changeTopbarTheme(e.target.value));
                          }
                        }}
                      />
                      <label
                        className="form-check-label p-0 avatar-md w-100"
                        htmlFor="topbar-color-light"
                        aria-label={t("product.customizer.light")}
                      >
                        <span className="d-flex gap-1 h-100">
                          <span className="flex-shrink-0">
                            <span className="bg-light d-flex h-100 flex-column gap-1 p-1">
                              <span className="d-block p-1 px-2 bg-primary-subtle rounded mb-2"></span>
                              <span className="d-block p-1 px-2 pb-0 bg-primary-subtle"></span>
                              <span className="d-block p-1 px-2 pb-0 bg-primary-subtle"></span>
                              <span className="d-block p-1 px-2 pb-0 bg-primary-subtle"></span>
                            </span>
                          </span>
                          <span className="flex-grow-1">
                            <span className="d-flex h-100 flex-column">
                              <span className="bg-light d-block p-1"></span>
                              <span className="bg-light d-block p-1 mt-auto"></span>
                            </span>
                          </span>
                        </span>
                      </label>
                    </div>
                    <h5 className="fs-13 text-center mt-2">{t("product.customizer.light")}</h5>
                  </div>
                  <div className="col-4">
                    <div className="form-check card-radio">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="data-topbar"
                        id="topbar-color-dark"
                        value={LAYOUT_TOPBAR_THEME_TYPES.DARK}
                        checked={topbarThemeType === LAYOUT_TOPBAR_THEME_TYPES.DARK}
                        onChange={(e) => {
                          if (e.target.checked) {
                            dispatch(changeTopbarTheme(e.target.value));
                          }
                        }}
                      />
                      <label
                        className="form-check-label p-0 avatar-md w-100"
                        htmlFor="topbar-color-dark"
                        aria-label={t("product.customizer.dark")}
                      >
                        <span className="d-flex gap-1 h-100">
                          <span className="flex-shrink-0">
                            <span className="bg-light d-flex h-100 flex-column gap-1 p-1">
                              <span className="d-block p-1 px-2 bg-primary-subtle rounded mb-2"></span>
                              <span className="d-block p-1 px-2 pb-0 bg-primary-subtle"></span>
                              <span className="d-block p-1 px-2 pb-0 bg-primary-subtle"></span>
                              <span className="d-block p-1 px-2 pb-0 bg-primary-subtle"></span>
                            </span>
                          </span>
                          <span className="flex-grow-1">
                            <span className="d-flex h-100 flex-column">
                              <span className="bg-primary d-block p-1"></span>
                              <span className="bg-light d-block p-1 mt-auto"></span>
                            </span>
                          </span>
                        </span>
                      </label>
                    </div>
                    <h5 className="fs-13 text-center mt-2">{t("product.customizer.dark")}</h5>
                  </div>
                </div>

                {(layoutType === "vertical" ||
                  (layoutType === "semibox" && sidebarVisibilitytype === "show")) && (
                  <React.Fragment>
                    <div id="sidebar-size">
                      <h6 className="mt-4 mb-0 fw-semibold text-uppercase">
                        {t("product.customizer.sidebarSize")}
                      </h6>
                      <p className="text-muted">{t("product.customizer.chooseSidebarSize")}</p>

                      <div className="row">
                        <div className="col-4">
                          <div className="form-check sidebar-setting card-radio">
                            <input
                              className="form-check-input"
                              type="radio"
                              name="data-sidebar-size"
                              id="sidebar-size-default"
                              value={LEFT_SIDEBAR_SIZE_TYPES.DEFAULT}
                              checked={leftsidbarSizeType === LEFT_SIDEBAR_SIZE_TYPES.DEFAULT}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  dispatch(changeLeftsidebarSizeType(e.target.value));
                                }
                              }}
                            />
                            <label
                              className="form-check-label p-0 avatar-md w-100"
                              htmlFor="sidebar-size-default"
                              aria-label={t("product.customizer.default")}
                            >
                              <span className="d-flex gap-1 h-100">
                                <span className="flex-shrink-0">
                                  <span className="bg-light d-flex h-100 flex-column gap-1 p-1">
                                    <span className="d-block p-1 px-2 bg-primary-subtle rounded mb-2"></span>
                                    <span className="d-block p-1 px-2 pb-0 bg-primary-subtle"></span>
                                    <span className="d-block p-1 px-2 pb-0 bg-primary-subtle"></span>
                                    <span className="d-block p-1 px-2 pb-0 bg-primary-subtle"></span>
                                  </span>
                                </span>
                                <span className="flex-grow-1">
                                  <span className="d-flex h-100 flex-column">
                                    <span className="bg-light d-block p-1"></span>
                                    <span className="bg-light d-block p-1 mt-auto"></span>
                                  </span>
                                </span>
                              </span>
                            </label>
                          </div>
                          <h5 className="fs-13 text-center mt-2">
                            {t("product.customizer.default")}
                          </h5>
                        </div>

                        <div className="col-4">
                          <div className="form-check sidebar-setting card-radio">
                            <input
                              className="form-check-input"
                              type="radio"
                              name="data-sidebar-size"
                              id="sidebar-size-compact"
                              value={LEFT_SIDEBAR_SIZE_TYPES.COMPACT}
                              checked={leftsidbarSizeType === LEFT_SIDEBAR_SIZE_TYPES.COMPACT}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  dispatch(changeLeftsidebarSizeType(e.target.value));
                                }
                              }}
                            />
                            <label
                              className="form-check-label p-0 avatar-md w-100"
                              htmlFor="sidebar-size-compact"
                              aria-label={t("product.customizer.compact")}
                            >
                              <span className="d-flex gap-1 h-100">
                                <span className="flex-shrink-0">
                                  <span className="bg-light d-flex h-100 flex-column gap-1 p-1">
                                    <span className="d-block p-1 bg-primary-subtle rounded mb-2"></span>
                                    <span className="d-block p-1 pb-0 bg-primary-subtle"></span>
                                    <span className="d-block p-1 pb-0 bg-primary-subtle"></span>
                                    <span className="d-block p-1 pb-0 bg-primary-subtle"></span>
                                  </span>
                                </span>
                                <span className="flex-grow-1">
                                  <span className="d-flex h-100 flex-column">
                                    <span className="bg-light d-block p-1"></span>
                                    <span className="bg-light d-block p-1 mt-auto"></span>
                                  </span>
                                </span>
                              </span>
                            </label>
                          </div>
                          <h5 className="fs-13 text-center mt-2">
                            {t("product.customizer.compact")}
                          </h5>
                        </div>

                        <div className="col-4">
                          <div className="form-check sidebar-setting card-radio">
                            <input
                              className="form-check-input"
                              type="radio"
                              name="data-sidebar-size"
                              id="sidebar-size-small"
                              value={LEFT_SIDEBAR_SIZE_TYPES.SMALLICON}
                              checked={leftsidbarSizeType === LEFT_SIDEBAR_SIZE_TYPES.SMALLICON}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  dispatch(changeLeftsidebarSizeType(e.target.value));
                                }
                              }}
                            />
                            <label
                              className="form-check-label p-0 avatar-md w-100"
                              htmlFor="sidebar-size-small"
                              aria-label={t("product.customizer.smallIcon")}
                            >
                              <span className="d-flex gap-1 h-100">
                                <span className="flex-shrink-0">
                                  <span className="bg-light d-flex h-100 flex-column gap-1">
                                    <span className="d-block p-1 bg-primary-subtle mb-2"></span>
                                    <span className="d-block p-1 pb-0 bg-primary-subtle"></span>
                                    <span className="d-block p-1 pb-0 bg-primary-subtle"></span>
                                    <span className="d-block p-1 pb-0 bg-primary-subtle"></span>
                                  </span>
                                </span>
                                <span className="flex-grow-1">
                                  <span className="d-flex h-100 flex-column">
                                    <span className="bg-light d-block p-1"></span>
                                    <span className="bg-light d-block p-1 mt-auto"></span>
                                  </span>
                                </span>
                              </span>
                            </label>
                          </div>
                          <h5 className="fs-13 text-center mt-2">
                            {t("product.customizer.smallIcon")}
                          </h5>
                        </div>

                        <div className="col-4">
                          <div className="form-check sidebar-setting card-radio">
                            <input
                              className="form-check-input"
                              type="radio"
                              name="data-sidebar-size"
                              id="sidebar-size-small-hover"
                              value={LEFT_SIDEBAR_SIZE_TYPES.SMALLHOVER}
                              checked={leftsidbarSizeType === LEFT_SIDEBAR_SIZE_TYPES.SMALLHOVER}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  dispatch(changeLeftsidebarSizeType(e.target.value));
                                }
                              }}
                            />
                            <label
                              className="form-check-label p-0 avatar-md w-100"
                              htmlFor="sidebar-size-small-hover"
                              aria-label={t("product.customizer.smallHover")}
                            >
                              <span className="d-flex gap-1 h-100">
                                <span className="flex-shrink-0">
                                  <span className="bg-light d-flex h-100 flex-column gap-1">
                                    <span className="d-block p-1 bg-primary-subtle mb-2"></span>
                                    <span className="d-block p-1 pb-0 bg-primary-subtle"></span>
                                    <span className="d-block p-1 pb-0 bg-primary-subtle"></span>
                                    <span className="d-block p-1 pb-0 bg-primary-subtle"></span>
                                  </span>
                                </span>
                                <span className="flex-grow-1">
                                  <span className="d-flex h-100 flex-column">
                                    <span className="bg-light d-block p-1"></span>
                                    <span className="bg-light d-block p-1 mt-auto"></span>
                                  </span>
                                </span>
                              </span>
                            </label>
                          </div>
                          <h5 className="fs-13 text-center mt-2">
                            {t("product.customizer.smallHover")}
                          </h5>
                        </div>
                      </div>
                    </div>

                    {layoutType !== "semibox" && (
                      <div id="sidebar-view">
                        <h6 className="mt-4 mb-0 fw-semibold text-uppercase">
                          {t("product.customizer.sidebarView")}
                        </h6>
                        <p className="text-muted">{t("product.customizer.chooseSidebarView")}</p>

                        <div className="row">
                          <div className="col-4">
                            <div className="form-check sidebar-setting card-radio">
                              <input
                                className="form-check-input"
                                type="radio"
                                name="data-layout-style"
                                id="sidebar-view-default"
                                value={LEFT_SIDEBAR_VIEW_TYPES.DEFAULT}
                                checked={leftSidebarViewType === LEFT_SIDEBAR_VIEW_TYPES.DEFAULT}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    dispatch(changeLeftsidebarViewType(e.target.value));
                                  }
                                }}
                              />
                              <label
                                className="form-check-label p-0 avatar-md w-100"
                                htmlFor="sidebar-view-default"
                                aria-label={t("product.customizer.default")}
                              >
                                <span className="d-flex gap-1 h-100">
                                  <span className="flex-shrink-0">
                                    <span className="bg-light d-flex h-100 flex-column gap-1 p-1">
                                      <span className="d-block p-1 px-2 bg-primary-subtle rounded mb-2"></span>
                                      <span className="d-block p-1 px-2 pb-0 bg-primary-subtle"></span>
                                      <span className="d-block p-1 px-2 pb-0 bg-primary-subtle"></span>
                                      <span className="d-block p-1 px-2 pb-0 bg-primary-subtle"></span>
                                    </span>
                                  </span>
                                  <span className="flex-grow-1">
                                    <span className="d-flex h-100 flex-column">
                                      <span className="bg-light d-block p-1"></span>
                                      <span className="bg-light d-block p-1 mt-auto"></span>
                                    </span>
                                  </span>
                                </span>
                              </label>
                            </div>
                            <h5 className="fs-13 text-center mt-2">
                              {t("product.customizer.default")}
                            </h5>
                          </div>
                          <div className="col-4">
                            <div className="form-check sidebar-setting card-radio">
                              <input
                                className="form-check-input"
                                type="radio"
                                name="data-layout-style"
                                id="sidebar-view-detached"
                                value={LEFT_SIDEBAR_VIEW_TYPES.DETACHED}
                                checked={leftSidebarViewType === LEFT_SIDEBAR_VIEW_TYPES.DETACHED}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    dispatch(changeLeftsidebarViewType(e.target.value));
                                  }
                                }}
                              />
                              <label
                                className="form-check-label p-0 avatar-md w-100"
                                htmlFor="sidebar-view-detached"
                                aria-label={t("product.customizer.detached")}
                              >
                                <span className="d-flex h-100 flex-column">
                                  <span className="bg-light d-flex p-1 gap-1 align-items-center px-2">
                                    <span className="d-block p-1 bg-primary-subtle rounded me-1"></span>
                                    <span className="d-block p-1 pb-0 px-2 bg-primary-subtle ms-auto"></span>
                                    <span className="d-block p-1 pb-0 px-2 bg-primary-subtle"></span>
                                  </span>
                                  <span className="d-flex gap-1 h-100 p-1 px-2">
                                    <span className="flex-shrink-0">
                                      <span className="bg-light d-flex h-100 flex-column gap-1 p-1">
                                        <span className="d-block p-1 px-2 pb-0 bg-primary-subtle"></span>
                                        <span className="d-block p-1 px-2 pb-0 bg-primary-subtle"></span>
                                        <span className="d-block p-1 px-2 pb-0 bg-primary-subtle"></span>
                                      </span>
                                    </span>
                                  </span>
                                  <span className="bg-light d-block p-1 mt-auto px-2"></span>
                                </span>
                              </label>
                            </div>
                            <h5 className="fs-13 text-center mt-2">
                              {t("product.customizer.detached")}
                            </h5>
                          </div>
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                )}

                {(layoutType === "vertical" ||
                  layoutType === "twocolumn" ||
                  (layoutType === "semibox" && sidebarVisibilitytype === "show")) && (
                  <React.Fragment>
                    <div id="sidebar-color">
                      <h6 className="mt-4 mb-0 fw-semibold text-uppercase">
                        {t("product.customizer.sidebarColor")}
                      </h6>
                      <p className="text-muted">{t("product.customizer.chooseSidebarColor")}</p>

                      <div className="row">
                        <div className="col-4">
                          <div className="form-check sidebar-setting card-radio">
                            <input
                              className="form-check-input"
                              type="radio"
                              name="data-sidebar"
                              id="sidebar-color-light"
                              value={LAYOUT_SIDEBAR_TYPES.LIGHT}
                              checked={leftSidebarType === LAYOUT_SIDEBAR_TYPES.LIGHT}
                              onChange={(e) => {
                                setShow(false);
                                if (e.target.checked) {
                                  dispatch(changeSidebarTheme(e.target.value));
                                }
                              }}
                            />
                            <label
                              className="form-check-label p-0 avatar-md w-100"
                              htmlFor="sidebar-color-light"
                              aria-label={t("product.customizer.light")}
                            >
                              <span className="d-flex gap-1 h-100">
                                <span className="flex-shrink-0">
                                  <span className="bg-white border-end d-flex h-100 flex-column gap-1 p-1">
                                    <span className="d-block p-1 px-2 bg-primary-subtle rounded mb-2"></span>
                                    <span className="d-block p-1 px-2 pb-0 bg-primary-subtle"></span>
                                    <span className="d-block p-1 px-2 pb-0 bg-primary-subtle"></span>
                                    <span className="d-block p-1 px-2 pb-0 bg-primary-subtle"></span>
                                  </span>
                                </span>
                                <span className="flex-grow-1">
                                  <span className="d-flex h-100 flex-column">
                                    <span className="bg-light d-block p-1"></span>
                                    <span className="bg-light d-block p-1 mt-auto"></span>
                                  </span>
                                </span>
                              </span>
                            </label>
                          </div>
                          <h5 className="fs-13 text-center mt-2">
                            {t("product.customizer.light")}
                          </h5>
                        </div>
                        <div className="col-4">
                          <div className="form-check sidebar-setting card-radio">
                            <input
                              className="form-check-input"
                              type="radio"
                              name="data-sidebar"
                              id="sidebar-color-dark"
                              value={LAYOUT_SIDEBAR_TYPES.DARK}
                              checked={leftSidebarType === LAYOUT_SIDEBAR_TYPES.DARK}
                              onChange={(e) => {
                                setShow(false);
                                if (e.target.checked) {
                                  dispatch(changeSidebarTheme(e.target.value));
                                }
                              }}
                            />
                            <label
                              className="form-check-label p-0 avatar-md w-100"
                              htmlFor="sidebar-color-dark"
                              aria-label={t("product.customizer.dark")}
                            >
                              <span className="d-flex gap-1 h-100">
                                <span className="flex-shrink-0">
                                  <span className="bg-primary d-flex h-100 flex-column gap-1 p-1">
                                    <span className="d-block p-1 px-2 bg-white bg-opacity-10 rounded mb-2"></span>
                                    <span className="d-block p-1 px-2 pb-0 bg-white bg-opacity-10"></span>
                                    <span className="d-block p-1 px-2 pb-0 bg-white bg-opacity-10"></span>
                                    <span className="d-block p-1 px-2 pb-0 bg-white bg-opacity-10"></span>
                                  </span>
                                </span>
                                <span className="flex-grow-1">
                                  <span className="d-flex h-100 flex-column">
                                    <span className="bg-light d-block p-1"></span>
                                    <span className="bg-light d-block p-1 mt-auto"></span>
                                  </span>
                                </span>
                              </span>
                            </label>
                          </div>
                          <h5 className="fs-13 text-center mt-2">{t("product.customizer.dark")}</h5>
                        </div>

                        <div className="col-4">
                          <button
                            className={classnames(
                              "btn btn-link avatar-md w-100 p-0 overflow-hidden border ",
                              { collapsed: !show, active: show === true },
                            )}
                            type="button"
                            aria-label={t("product.customizer.gradient")}
                            data-bs-target="#collapseBgGradient"
                            data-bs-toggle="collapse"
                            aria-controls="collapseBgGradient"
                            onClick={tog_show}
                          >
                            <span className="d-flex gap-1 h-100">
                              <span className="flex-shrink-0">
                                <span className="bg-vertical-gradient d-flex h-100 flex-column gap-1 p-1">
                                  <span className="d-block p-1 px-2 bg-white bg-opacity-10 rounded mb-2"></span>
                                  <span className="d-block p-1 px-2 pb-0 bg-white bg-opacity-10"></span>
                                  <span className="d-block p-1 px-2 pb-0 bg-white bg-opacity-10"></span>
                                  <span className="d-block p-1 px-2 pb-0 bg-white bg-opacity-10"></span>
                                </span>
                              </span>
                              <span className="flex-grow-1">
                                <span className="d-flex h-100 flex-column">
                                  <span className="bg-light d-block p-1"></span>
                                  <span className="bg-light d-block p-1 mt-auto"></span>
                                </span>
                              </span>
                            </span>
                          </button>
                          <h5 className="fs-13 text-center mt-2">
                            {t("product.customizer.gradient")}
                          </h5>
                        </div>
                      </div>
                      <Collapse isOpen={show} className="collapse" id="collapseBgGradient">
                        <div className="d-flex gap-2 flex-wrap img-switch p-2 px-3 bg-light rounded">
                          <div className="form-check sidebar-setting card-radio">
                            <input
                              className="form-check-input"
                              type="radio"
                              name="data-sidebar"
                              id="sidebar-color-gradient"
                              value={LAYOUT_SIDEBAR_TYPES.GRADIENT}
                              checked={leftSidebarType === LAYOUT_SIDEBAR_TYPES.GRADIENT}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  dispatch(changeSidebarTheme(e.target.value));
                                }
                              }}
                            />
                            <label
                              className="form-check-label p-0 avatar-xs rounded-circle"
                              htmlFor="sidebar-color-gradient"
                              aria-label={t("product.customizer.gradient")}
                            >
                              <span className="avatar-title rounded-circle bg-vertical-gradient"></span>
                            </label>
                          </div>
                          <div className="form-check sidebar-setting card-radio">
                            <input
                              className="form-check-input"
                              type="radio"
                              name="data-sidebar"
                              id="sidebar-color-gradient-2"
                              value={LAYOUT_SIDEBAR_TYPES.GRADIENT_2}
                              checked={leftSidebarType === LAYOUT_SIDEBAR_TYPES.GRADIENT_2}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  dispatch(changeSidebarTheme(e.target.value));
                                }
                              }}
                            />
                            <label
                              className="form-check-label p-0 avatar-xs rounded-circle"
                              htmlFor="sidebar-color-gradient-2"
                              aria-label={t("product.customizer.gradient")}
                            >
                              <span className="avatar-title rounded-circle bg-vertical-gradient-2"></span>
                            </label>
                          </div>
                          <div className="form-check sidebar-setting card-radio">
                            <input
                              className="form-check-input"
                              type="radio"
                              name="data-sidebar"
                              id="sidebar-color-gradient-3"
                              value={LAYOUT_SIDEBAR_TYPES.GRADIENT_3}
                              checked={leftSidebarType === LAYOUT_SIDEBAR_TYPES.GRADIENT_3}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  dispatch(changeSidebarTheme(e.target.value));
                                }
                              }}
                            />
                            <label
                              className="form-check-label p-0 avatar-xs rounded-circle"
                              htmlFor="sidebar-color-gradient-3"
                              aria-label={t("product.customizer.gradient")}
                            >
                              <span className="avatar-title rounded-circle bg-vertical-gradient-3"></span>
                            </label>
                          </div>
                          <div className="form-check sidebar-setting card-radio">
                            <input
                              className="form-check-input"
                              type="radio"
                              name="data-sidebar"
                              id="sidebar-color-gradient-4"
                              value={LAYOUT_SIDEBAR_TYPES.GRADIENT_4}
                              checked={leftSidebarType === LAYOUT_SIDEBAR_TYPES.GRADIENT_4}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  dispatch(changeSidebarTheme(e.target.value));
                                }
                              }}
                            />
                            <label
                              className="form-check-label p-0 avatar-xs rounded-circle"
                              htmlFor="sidebar-color-gradient-4"
                              aria-label={t("product.customizer.gradient")}
                            >
                              <span className="avatar-title rounded-circle bg-vertical-gradient-4"></span>
                            </label>
                          </div>
                        </div>
                      </Collapse>
                    </div>
                    <div id="sidebar-img">
                      <h6 className="mt-4 mb-0 fw-semibold text-uppercase">
                        {t("product.customizer.sidebarImages")}
                      </h6>
                      <p className="text-muted">{t("product.customizer.chooseSidebarImage")}</p>

                      <div className="d-flex gap-2 flex-wrap img-switch">
                        <div className="form-check sidebar-setting card-radio">
                          <input
                            className="form-check-input"
                            type="radio"
                            name="data-sidebar-image"
                            id="sidebarimg-none"
                            value={LEFT_SIDEBAR_IMAGE_TYPES.NONE}
                            checked={leftSidebarImageType === LEFT_SIDEBAR_IMAGE_TYPES.NONE}
                            onChange={(e) => {
                              if (e.target.checked) {
                                dispatch(changeSidebarImageType(e.target.value));
                              }
                            }}
                          />
                          <label
                            className="form-check-label p-0 avatar-sm h-auto"
                            htmlFor="sidebarimg-none"
                            aria-label={t("product.customizer.noImage")}
                          >
                            <span className="avatar-md w-auto bg-light d-flex align-items-center justify-content-center">
                              <i className="ri-close-fill fs-20"></i>
                            </span>
                          </label>
                        </div>

                        <div className="form-check sidebar-setting card-radio">
                          <input
                            className="form-check-input"
                            type="radio"
                            name="data-sidebar-image"
                            id="sidebarimg-01"
                            value={LEFT_SIDEBAR_IMAGE_TYPES.IMG1}
                            checked={leftSidebarImageType === LEFT_SIDEBAR_IMAGE_TYPES.IMG1}
                            onChange={(e) => {
                              if (e.target.checked) {
                                dispatch(changeSidebarImageType(e.target.value));
                              }
                            }}
                          />
                          <label
                            className="form-check-label p-0 avatar-sm h-auto"
                            htmlFor="sidebarimg-01"
                            aria-label={t("product.customizer.backgroundImage", { number: 1 })}
                          >
                            <img
                              src={shellAssets.sidebarImage1}
                              alt=""
                              className="avatar-md w-auto object-fit-cover"
                            />
                          </label>
                        </div>

                        <div className="form-check sidebar-setting card-radio">
                          <input
                            className="form-check-input"
                            type="radio"
                            name="data-sidebar-image"
                            id="sidebarimg-02"
                            value={LEFT_SIDEBAR_IMAGE_TYPES.IMG2}
                            checked={leftSidebarImageType === LEFT_SIDEBAR_IMAGE_TYPES.IMG2}
                            onChange={(e) => {
                              if (e.target.checked) {
                                dispatch(changeSidebarImageType(e.target.value));
                              }
                            }}
                          />
                          <label
                            className="form-check-label p-0 avatar-sm h-auto"
                            htmlFor="sidebarimg-02"
                            aria-label={t("product.customizer.backgroundImage", { number: 2 })}
                          >
                            <img
                              src={shellAssets.sidebarImage2}
                              alt=""
                              className="avatar-md w-auto object-fit-cover"
                            />
                          </label>
                        </div>
                        <div className="form-check sidebar-setting card-radio">
                          <input
                            className="form-check-input"
                            type="radio"
                            name="data-sidebar-image"
                            id="sidebarimg-03"
                            value={LEFT_SIDEBAR_IMAGE_TYPES.IMG3}
                            checked={leftSidebarImageType === LEFT_SIDEBAR_IMAGE_TYPES.IMG3}
                            onChange={(e) => {
                              if (e.target.checked) {
                                dispatch(changeSidebarImageType(e.target.value));
                              }
                            }}
                          />
                          <label
                            className="form-check-label p-0 avatar-sm h-auto"
                            htmlFor="sidebarimg-03"
                            aria-label={t("product.customizer.backgroundImage", { number: 3 })}
                          >
                            <img
                              src={shellAssets.sidebarImage3}
                              alt=""
                              className="avatar-md w-auto object-fit-cover"
                            />
                          </label>
                        </div>
                        <div className="form-check sidebar-setting card-radio">
                          <input
                            className="form-check-input"
                            type="radio"
                            name="data-sidebar-image"
                            id="sidebarimg-04"
                            value={LEFT_SIDEBAR_IMAGE_TYPES.IMG4}
                            checked={leftSidebarImageType === LEFT_SIDEBAR_IMAGE_TYPES.IMG4}
                            onChange={(e) => {
                              if (e.target.checked) {
                                dispatch(changeSidebarImageType(e.target.value));
                              }
                            }}
                          />
                          <label
                            className="form-check-label p-0 avatar-sm h-auto"
                            htmlFor="sidebarimg-04"
                            aria-label={t("product.customizer.backgroundImage", { number: 4 })}
                          >
                            <img
                              src={shellAssets.sidebarImage4}
                              alt=""
                              className="avatar-md w-auto object-fit-cover"
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                )}

                <div id="preloader-menu">
                  <h6 className="mt-4 mb-0 fw-semibold text-uppercase">
                    {t("product.customizer.preloader")}
                  </h6>
                  <p className="text-muted">{t("product.customizer.choosePreloader")}</p>

                  <div className="row">
                    <div className="col-4">
                      <div className="form-check sidebar-setting card-radio">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="data-preloader"
                          id="preloader-view-custom"
                          value={PERLOADER_TYPES.ENABLE}
                          checked={preloader === PERLOADER_TYPES.ENABLE}
                          onChange={(e) => {
                            if (e.target.checked) {
                              dispatch(changePreLoader(e.target.value));
                            }
                          }}
                        />

                        <label
                          className="form-check-label p-0 avatar-md w-100"
                          htmlFor="preloader-view-custom"
                        >
                          <span className="d-flex gap-1 h-100">
                            <span className="flex-shrink-0">
                              <span className="bg-light d-flex h-100 flex-column gap-1 p-1">
                                <span className="d-block p-1 px-2 bg-primary-subtle rounded mb-2"></span>
                                <span className="d-block p-1 px-2 pb-0 bg-primary-subtle"></span>
                                <span className="d-block p-1 px-2 pb-0 bg-primary-subtle"></span>
                                <span className="d-block p-1 px-2 pb-0 bg-primary-subtle"></span>
                              </span>
                            </span>
                            <span className="flex-grow-1">
                              <span className="d-flex h-100 flex-column">
                                <span className="bg-light d-block p-1"></span>
                                <span className="bg-light d-block p-1 mt-auto"></span>
                              </span>
                            </span>
                          </span>
                          {/* <!-- <div id="preloader"> --> */}
                          <div
                            id="status"
                            className="d-flex align-items-center justify-content-center"
                          >
                            <output className="spinner-border text-primary avatar-xxs m-auto">
                              <span className="visually-hidden">
                                {t("product.customizer.loading")}
                              </span>
                            </output>
                          </div>
                          {/* <!-- </div> --> */}
                        </label>
                      </div>
                      <h5 className="fs-13 text-center mt-2">{t("product.customizer.enable")}</h5>
                    </div>
                    <div className="col-4">
                      <div className="form-check sidebar-setting card-radio">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="data-preloader"
                          id="preloader-view-none"
                          value={PERLOADER_TYPES.DISABLE}
                          checked={preloader === PERLOADER_TYPES.DISABLE}
                          onChange={(e) => {
                            if (e.target.checked) {
                              dispatch(changePreLoader(e.target.value));
                            }
                          }}
                        />
                        <label
                          className="form-check-label p-0 avatar-md w-100"
                          htmlFor="preloader-view-none"
                          aria-label={t("product.customizer.disable")}
                        >
                          <span className="d-flex gap-1 h-100">
                            <span className="flex-shrink-0">
                              <span className="bg-light d-flex h-100 flex-column gap-1 p-1">
                                <span className="d-block p-1 px-2 bg-primary-subtle rounded mb-2"></span>
                                <span className="d-block p-1 px-2 pb-0 bg-primary-subtle"></span>
                                <span className="d-block p-1 px-2 pb-0 bg-primary-subtle"></span>
                                <span className="d-block p-1 px-2 pb-0 bg-primary-subtle"></span>
                              </span>
                            </span>
                            <span className="flex-grow-1">
                              <span className="d-flex h-100 flex-column">
                                <span className="bg-light d-block p-1"></span>
                                <span className="bg-light d-block p-1 mt-auto"></span>
                              </span>
                            </span>
                          </span>
                        </label>
                      </div>
                      <h5 className="fs-13 text-center mt-2">{t("product.customizer.disable")}</h5>
                    </div>
                  </div>
                </div>
              </div>
            </SimpleBar>
          </OffcanvasBody>
        </Offcanvas>
      </div>
    </React.Fragment>
  );
};

export default withRouter(RightSidebar);
