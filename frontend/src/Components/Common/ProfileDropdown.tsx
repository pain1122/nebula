import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { Dropdown, DropdownItem, DropdownToggle } from "reactstrap";
import DropdownMenu from "./DirectionalDropdownMenu";

import { useShellAuth } from "../../Layouts/ShellAuthContext";
import { shellAssets } from "../../Layouts/shellAssets";
import { adminAuthAuthority } from "../../modules/checkupino/auth/authority";

const ProfileDropdown = () => {
  const { t } = useTranslation();
  const { userProfile } = useShellAuth();
  const navigate = useNavigate();
  const [isProfileDropdown, setIsProfileDropdown] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const userName = userProfile?.name || t("product.role.admin");
  const userRole = userProfile?.roles?.[0] || "admin";

  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await adminAuthAuthority.logout();
    } catch {
      // Local trust is already cleared even when the server cannot acknowledge logout.
    } finally {
      void navigate("/login", { replace: true });
    }
  };

  return (
    <Dropdown
      isOpen={isProfileDropdown}
      toggle={() => setIsProfileDropdown((current) => !current)}
      className="ms-sm-3 header-item topbar-user"
    >
      <DropdownToggle tag="button" type="button" className="btn">
        <span className="d-flex align-items-center">
          <img
            className="rounded-circle header-profile-user"
            src={shellAssets.profileAvatar}
            alt={t("product.profile.avatarAlt")}
          />
          <span className="text-start ms-xl-2">
            <span className="d-none d-xl-inline-block ms-1 fw-medium user-name-text">
              {userName}
            </span>
            <span className="d-none d-xl-block ms-1 fs-12 text-muted user-name-sub-text">
              {userRole}
            </span>
          </span>
        </span>
      </DropdownToggle>
      <DropdownMenu className="dropdown-menu-end">
        <h6 className="dropdown-header">{t("product.profile.welcome", { name: userName })}</h6>
        <DropdownItem className="p-0">
          <Link to="/profile" className="dropdown-item" onClick={() => setIsProfileDropdown(false)}>
            <i className="mdi mdi-account-circle text-muted fs-16 align-middle me-1" />
            <span className="align-middle">{t("product.profile.profile")}</span>
          </Link>
        </DropdownItem>
        <div className="dropdown-divider" />
        <DropdownItem className="p-0" disabled={loggingOut} tag="div">
          <button className="dropdown-item" onClick={() => void logout()} type="button">
            <i className="mdi mdi-logout text-muted fs-16 align-middle me-1" />
            <span className="align-middle" data-key="t-logout">
              {loggingOut ? t("product.profile.loggingOut") : t("product.profile.logout")}
            </span>
          </button>
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
};

export default ProfileDropdown;
