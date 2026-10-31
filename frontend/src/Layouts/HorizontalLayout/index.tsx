import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Link, useLocation } from "react-router-dom";
import { Col, Collapse, Row } from "reactstrap";
import withRouter from "../../Components/Common/withRouter";

// Import Data
import { useNavigationMenu } from "../LayoutMenuData";
//i18n
import { withTranslation } from "react-i18next";
import { joinPath, runtimeConfig } from "../../core/runtime/config";

const HorizontalLayout = (props: any) => {
  const location = useLocation();
  const locationKey = location.pathname + location.search;
  const [more, setMore] = useState({ location: "", open: false });
  const navData = useNavigationMenu();
  let menuItems = [];
  let splitMenuItems: Array<any> = [];
  let menuSplitContainer = 6;
  navData.forEach(function (value: any, key: number) {
    if (value["isHeader"]) {
      menuSplitContainer++;
    }
    if (key >= menuSplitContainer) {
      let val = {
        ...value,
        childItems: value.subItems,
        isChildItem: Boolean(value.subItems),
      };
      delete val.subItems;
      splitMenuItems.push(val);
    } else {
      menuItems.push(value);
    }
  });
  const isMoreMenu =
    more.location === locationKey ? more.open : splitMenuItems.some((item) => item.active);
  menuItems.push({
    id: "more",
    label: "More",
    icon: "ri-briefcase-2-line",
    link: "/#",
    stateVariables: isMoreMenu,
    subItems: splitMenuItems,
    click: function (e: any) {
      e.preventDefault();
      setMore({ location: locationKey, open: !isMoreMenu });
    },
  });

  const path = props.router.location.pathname;

  function activateParentDropdown(item: any) {
    item.classList.add("active");
    let parentCollapseDiv = item.closest(".collapse.menu-dropdown");

    if (parentCollapseDiv) {
      // to set aria expand true remaining
      parentCollapseDiv.classList.add("show");
      parentCollapseDiv.parentElement.children[0].classList.add("active");
      parentCollapseDiv.parentElement.children[0].setAttribute("aria-expanded", "true");
      if (parentCollapseDiv.parentElement.closest(".collapse.menu-dropdown")) {
        parentCollapseDiv.parentElement.closest(".collapse").classList.add("show");
        var parentElementDiv =
          parentCollapseDiv.parentElement.closest(".collapse").previousElementSibling;
        if (parentElementDiv)
          if (parentElementDiv.closest(".collapse"))
            parentElementDiv.closest(".collapse").classList.add("show");
        parentElementDiv.classList.add("active");
        var parentElementSibling =
          parentElementDiv.parentElement.parentElement.parentElement.previousElementSibling;
        if (parentElementSibling) {
          parentElementSibling.classList.add("active");
        }
      }
      return false;
    }
    return false;
  }

  const removeActivation = (items: any) => {
    let actiItems = items.filter((x: any) => x.classList.contains("active"));

    actiItems.forEach((item: any) => {
      if (item.classList.contains("menu-link")) {
        if (!item.classList.contains("active")) {
          item.setAttribute("aria-expanded", false);
        }
        if (item.nextElementSibling) {
          item.nextElementSibling.classList.remove("show");
        }
      }
      if (item.classList.contains("nav-link")) {
        if (item.nextElementSibling) {
          item.nextElementSibling.classList.remove("show");
        }
        item.setAttribute("aria-expanded", false);
      }
      item.classList.remove("active");
    });
  };

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    window.scrollTo({ top: 0, behavior: "smooth" });
    const initMenu = () => {
      const pathName = joinPath(runtimeConfig.routerBase, path);
      const ul = document.getElementById("navbar-nav");
      if (!ul) return;
      const items: any = ul.getElementsByTagName("a");
      let itemsArray = [...items].filter((item) => !item.closest("[data-product-navigation]"));
      removeActivation(itemsArray);
      let matchingMenuItem = itemsArray.find((x) => {
        return x.pathname === pathName;
      });
      if (matchingMenuItem) {
        activateParentDropdown(matchingMenuItem);
      }
    };
    initMenu();
  }, [path, props.layoutType]);

  return (
    <React.Fragment>
      {(menuItems || []).map((item: any, key: number) => {
        return (
          <React.Fragment key={key}>
            {/* Main Header */}
            {!item["isHeader"] ? (
              item.subItems ? (
                <li className="nav-item" data-product-navigation={item.product || undefined}>
                  <Link
                    onClick={item.click}
                    className={
                      "nav-link menu-link" +
                      (item.active ? " active bg-primary-subtle text-primary rounded" : "")
                    }
                    aria-expanded={item.stateVariables}
                    aria-controls={item.id}
                    to={item.link ? item.link : "/#"}
                    data-bs-toggle="collapse"
                  >
                    <i className={item.icon}></i>{" "}
                    <span data-key="t-apps">{props.t(item.label)}</span>
                  </Link>
                  <Collapse
                    className={
                      item.id === "baseUi" && item.subItems.length > 13
                        ? "menu-dropdown mega-dropdown-menu"
                        : "menu-dropdown"
                    }
                    isOpen={item.stateVariables}
                    id={item.id}
                  >
                    {/* subItms  */}
                    {item.id === "baseUi" && item.subItems.length > 13 ? (
                      <React.Fragment>
                        <Row>
                          {item.subItems &&
                            (item.subItems || []).map((subItem: any, key: number) => (
                              <React.Fragment key={key}>
                                {key % 2 === 0 ? (
                                  <Col lg={4}>
                                    <ul className="nav nav-sm flex-column">
                                      <li className="nav-item">
                                        <Link to={item.subItems[key].link} className="nav-link">
                                          {item.subItems[key].label}
                                        </Link>
                                      </li>
                                    </ul>
                                  </Col>
                                ) : (
                                  <Col lg={4}>
                                    <ul className="nav nav-sm flex-column">
                                      <li className="nav-item">
                                        <Link to={item.subItems[key].link} className="nav-link">
                                          {item.subItems[key].label}
                                        </Link>
                                      </li>
                                    </ul>
                                  </Col>
                                )}
                              </React.Fragment>
                            ))}
                        </Row>
                      </React.Fragment>
                    ) : (
                      <ul className="nav nav-sm flex-column test">
                        {item.subItems &&
                          (item.subItems || []).map((subItem: any, key: number) => (
                            <React.Fragment key={key}>
                              {!subItem.isChildItem ? (
                                <li className="nav-item">
                                  <Link
                                    to={subItem.link ? subItem.link : "/#"}
                                    className={
                                      "nav-link" +
                                      (subItem.active
                                        ? " active bg-primary-subtle text-primary rounded"
                                        : "")
                                    }
                                    aria-current={subItem.active ? "page" : undefined}
                                  >
                                    {props.t(subItem.label)}
                                  </Link>
                                </li>
                              ) : (
                                <li className="nav-item">
                                  <Link
                                    onClick={subItem.click}
                                    className="nav-link"
                                    to="/#"
                                    aria-expanded={subItem.stateVariables}
                                    aria-controls={subItem.product ? subItem.id : undefined}
                                    data-bs-toggle="collapse"
                                  >
                                    {" "}
                                    {props.t(subItem.label)}
                                  </Link>
                                  <Collapse
                                    className="menu-dropdown"
                                    isOpen={subItem.stateVariables}
                                    id={subItem.product ? subItem.id : "sidebarEcommerce"}
                                  >
                                    <ul className="nav nav-sm flex-column">
                                      {/* child subItms  */}
                                      {subItem.childItems &&
                                        (subItem.childItems || []).map(
                                          (subChildItem: any, key: number) => (
                                            <React.Fragment key={key}>
                                              {!subChildItem.isChildItem ? (
                                                <li className="nav-item">
                                                  <Link
                                                    to={
                                                      subChildItem.link ? subChildItem.link : "/#"
                                                    }
                                                    className={
                                                      "nav-link" +
                                                      (subChildItem.active
                                                        ? " active bg-primary-subtle text-primary rounded"
                                                        : "")
                                                    }
                                                    aria-current={
                                                      subChildItem.active ? "page" : undefined
                                                    }
                                                  >
                                                    {props.t(subChildItem.label)}
                                                  </Link>
                                                </li>
                                              ) : (
                                                <li className="nav-item">
                                                  <Link
                                                    onClick={subChildItem.click}
                                                    className="nav-link"
                                                    to="/#"
                                                    data-bs-toggle="collapse"
                                                  >
                                                    {" "}
                                                    {props.t(subChildItem.label)}
                                                  </Link>
                                                  <Collapse
                                                    className="menu-dropdown"
                                                    isOpen={subChildItem.stateVariables}
                                                    id="sidebarEcommerce"
                                                  >
                                                    <ul className="nav nav-sm flex-column">
                                                      {/* child subItms  */}
                                                      {subChildItem.childItems &&
                                                        (subChildItem.childItems || []).map(
                                                          (subSubChildItem: any, key: number) => (
                                                            <li className="nav-item apex" key={key}>
                                                              <Link
                                                                to={
                                                                  subSubChildItem.link
                                                                    ? subSubChildItem.link
                                                                    : "/#"
                                                                }
                                                                className="nav-link"
                                                              >
                                                                {props.t(subSubChildItem.label)}
                                                              </Link>
                                                            </li>
                                                          ),
                                                        )}
                                                    </ul>
                                                  </Collapse>
                                                </li>
                                              )}
                                            </React.Fragment>
                                          ),
                                        )}
                                    </ul>
                                  </Collapse>
                                </li>
                              )}
                            </React.Fragment>
                          ))}
                      </ul>
                    )}
                  </Collapse>
                </li>
              ) : (
                <li className="nav-item" data-product-navigation={item.product || undefined}>
                  <Link
                    className={
                      "nav-link menu-link" +
                      (item.active ? " active bg-primary-subtle text-primary rounded" : "")
                    }
                    aria-current={item.active ? "page" : undefined}
                    to={item.link ? item.link : "/#"}
                  >
                    <i className={item.icon}></i> <span>{props.t(item.label)}</span>
                  </Link>
                </li>
              )
            ) : (
              <li className="menu-title">
                <span data-key="t-menu">{props.t(item.label)}</span>
              </li>
            )}
          </React.Fragment>
        );
      })}
      {/* menu Items */}
    </React.Fragment>
  );
};

HorizontalLayout.propTypes = {
  location: PropTypes.object,
  t: PropTypes.any,
};

export default withRouter(withTranslation()(HorizontalLayout));
