import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Dropdown, DropdownToggle, Form } from "reactstrap";
import DropdownMenu from "../Components/Common/DirectionalDropdownMenu";
import { useDispatch, useSelector } from "react-redux";

import { shellAssets } from "./shellAssets";
import SearchOption from "../Components/Common/SearchOption";
import LanguageDropdown from "../Components/Common/LanguageDropdown";
import FullScreenDropdown from "../Components/Common/FullScreenDropdown";
import ProfileDropdown from "../Components/Common/ProfileDropdown";
import LightDark from "../Components/Common/LightDark";
import { changeSidebarVisibility } from "../slices/layouts/thunk";

const Header = ({ onChangeLayoutMode, layoutModeType, headerClass }: any) => {
  const { t } = useTranslation();
  const dispatch: any = useDispatch();
  const sidebarVisibilitytype = useSelector((state: any) => state.Layout.sidebarVisibilitytype);
  const [search, setSearch] = useState(false);

  const toggleMenu = () => {
    if (typeof document === "undefined") return;
    const windowSize = document.documentElement.clientWidth;
    const hamburgerIcon = document.querySelector<HTMLElement>(".hamburger-icon");
    dispatch(changeSidebarVisibility("show"));

    if (windowSize > 767 && hamburgerIcon) hamburgerIcon.classList.toggle("open");

    if (document.documentElement.getAttribute("data-layout") === "horizontal") {
      document.body.classList.toggle("menu");
    }

    if (
      sidebarVisibilitytype === "show" &&
      ["vertical", "semibox"].includes(document.documentElement.getAttribute("data-layout") || "")
    ) {
      if (windowSize < 1025 && windowSize > 767) {
        document.body.classList.remove("vertical-sidebar-enable");
        document.documentElement.setAttribute(
          "data-sidebar-size",
          document.documentElement.getAttribute("data-sidebar-size") === "sm" ? "" : "sm",
        );
      } else if (windowSize > 1025) {
        document.body.classList.remove("vertical-sidebar-enable");
        document.documentElement.setAttribute(
          "data-sidebar-size",
          document.documentElement.getAttribute("data-sidebar-size") === "lg" ? "sm" : "lg",
        );
      } else {
        document.body.classList.add("vertical-sidebar-enable");
        document.documentElement.setAttribute("data-sidebar-size", "lg");
      }
    }

    if (document.documentElement.getAttribute("data-layout") === "twocolumn") {
      document.body.classList.toggle("twocolumn-panel");
    }
  };

  return (
    <header id="page-topbar" className={headerClass}>
      <div className="layout-width">
        <div className="navbar-header">
          <div className="d-flex">
            <div className="navbar-brand-box horizontal-logo">
              <Link to="/" className="logo logo-dark">
                <span className="logo-sm">
                  <img src={shellAssets.logoSm} alt="" height="22" />
                </span>
                <span className="logo-lg">
                  <img src={shellAssets.logoDark} alt="" height="17" />
                </span>
              </Link>
              <Link to="/" className="logo logo-light">
                <span className="logo-sm">
                  <img src={shellAssets.logoSm} alt="" height="22" />
                </span>
                <span className="logo-lg">
                  <img src={shellAssets.logoLight} alt="" height="17" />
                </span>
              </Link>
            </div>

            <button
              aria-label={t("product.shell.toggleNavigation")}
              className="btn btn-sm px-3 fs-16 header-item vertical-menu-btn topnav-hamburger"
              id="topnav-hamburger-icon"
              onClick={toggleMenu}
              type="button"
            >
              <span aria-hidden="true" className="hamburger-icon">
                <span />
                <span />
                <span />
              </span>
            </button>
            <SearchOption />
          </div>

          <div className="d-flex align-items-center">
            <Dropdown
              isOpen={search}
              toggle={() => setSearch((current) => !current)}
              className="d-md-none topbar-head-dropdown header-item"
            >
              <DropdownToggle
                aria-label={t("product.search.open")}
                type="button"
                tag="button"
                className="btn btn-icon btn-topbar btn-ghost-secondary rounded-circle"
              >
                <i aria-hidden="true" className="bx bx-search fs-22" />
              </DropdownToggle>
              <DropdownMenu className="dropdown-menu-lg dropdown-menu-end p-0">
                <Form className="p-3">
                  <div className="form-group m-0">
                    <div className="input-group">
                      <input
                        aria-label={t("product.search.label")}
                        className="form-control"
                        placeholder={t("product.search.placeholder")}
                        type="text"
                      />
                      <button
                        aria-label={t("product.search.submit")}
                        className="btn btn-primary"
                        type="submit"
                      >
                        <i aria-hidden="true" className="mdi mdi-magnify" />
                      </button>
                    </div>
                  </div>
                </Form>
              </DropdownMenu>
            </Dropdown>
            <LanguageDropdown />
            <FullScreenDropdown />
            <LightDark layoutMode={layoutModeType} onChangeLayoutMode={onChangeLayoutMode} />
            <ProfileDropdown />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
