import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Input } from "reactstrap";

//SimpleBar
import SimpleBar from "simplebar-react";

import { useNavigationMenu } from "Layouts/LayoutMenuData";

const SearchOption = () => {
  const { t } = useTranslation();
  const navData = useNavigationMenu();
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const searchRoot = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const closeOutside = (event: MouseEvent) => {
      if (event.target instanceof Node && !searchRoot.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOutside);
    return () => document.removeEventListener("mousedown", closeOutside);
  }, []);

  const onKeyDownPress = (e: any) => {
    const { key } = e;
    if (key === "Enter") {
      e.preventDefault();
      setSearchTerm(e.target.value);
    }
  };
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextSearchTerm = event.target.value;
    setSearchTerm(nextSearchTerm);
    setIsOpen(nextSearchTerm.length > 0);
  };

  // Filter routes based on search term
  const filterData = useMemo(() => {
    return navData.reduce((result: any, menuItem: any) => {
      const lowercaseLabel = menuItem.label ? t(menuItem.label).toLowerCase() : "";
      const lowercaseLink = menuItem.link ? menuItem.link.toLowerCase() : "";

      if (
        lowercaseLabel.includes(searchTerm.toLowerCase()) ||
        lowercaseLink.includes(searchTerm.toLowerCase())
      ) {
        result.push(menuItem);
      }

      const filteredSubItems = (menuItem.subItems || []).filter((subItem: any) => {
        const lowercaseSubItemLabel = subItem.label ? t(subItem.label).toLowerCase() : "";
        const lowercaseSubItemLink = subItem.link ? subItem.link.toLowerCase() : "";

        return (
          lowercaseSubItemLabel.includes(searchTerm.toLowerCase()) ||
          lowercaseSubItemLink.includes(searchTerm.toLowerCase())
        );
      });

      if (filteredSubItems.length > 0) {
        const menuItemWithSubItems = { ...menuItem, subItems: filteredSubItems };
        result.push(menuItemWithSubItems);
      }

      return result;
    }, []);
  }, [navData, searchTerm, t]);

  return (
    <React.Fragment>
      <form
        ref={searchRoot}
        className="app-search d-none d-md-block"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="position-relative">
          <Input
            type="text"
            className="form-control"
            placeholder={t("product.search.placeholder")}
            id="search-options"
            value={searchTerm}
            onFocus={() => setIsOpen(searchTerm.length > 0)}
            onKeyDown={onKeyDownPress}
            onChange={handleChange}
          />
          <span className="mdi mdi-magnify search-widget-icon"></span>
          <button
            type="button"
            aria-label={t("product.search.clear")}
            className={`mdi mdi-close-circle search-widget-icon search-widget-icon-close border-0 bg-transparent${searchTerm ? "" : " d-none"}`}
            id="search-close-options"
            onClick={() => {
              setSearchTerm("");
              setIsOpen(false);
            }}
          />
        </div>
        <div
          className={`dropdown-menu dropdown-menu-lg${isOpen ? " show" : ""}`}
          id="search-dropdown"
        >
          <SimpleBar style={{ height: "320px" }}>
            {/* <div className="dropdown-header">
                            <h6 className="text-overflow text-muted mb-0 text-uppercase">Recent Searches</h6>
                        </div> */}

            <div className="dropdown-header mt-2">
              <h6 className="text-overflow text-muted mb-1 text-uppercase">
                {t("product.search.pages")}
              </h6>
            </div>

            {filterData.map((menuItem: any, index: number) => (
              <React.Fragment key={index}>
                {!menuItem.subItems ? (
                  <Link to={menuItem.link} className="dropdown-item notify-item">
                    <i className={menuItem.icon + " align-middle fs-xl text-muted me-2"}></i>
                    <span>{t(menuItem.label)}</span>
                  </Link>
                ) : (
                  <div className="dropdown-header mt-2">
                    <h6 className="text-overflow text-muted mb-1 text-uppercase">
                      {t(menuItem.label)}
                    </h6>
                  </div>
                )}
                {menuItem.subItems && menuItem.subItems.length > 0 && (
                  <>
                    {menuItem.subItems.map((subItem: any, subIndex: number) => (
                      <Link key={subIndex} to={subItem.link} className="dropdown-item notify-item">
                        <i className={menuItem.icon + " align-middle fs-xl text-muted me-2"}></i>
                        <span>{t(subItem.label)}</span>
                      </Link>
                    ))}
                  </>
                )}
              </React.Fragment>
            ))}
          </SimpleBar>
        </div>
      </form>
    </React.Fragment>
  );
};

export default SearchOption;
