import React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Card, CardBody, CardHeader, Col, DropdownItem, DropdownToggle, UncontrolledDropdown } from "reactstrap";
import DropdownMenu from "../../Components/Common/DirectionalDropdownMenu";
import { bestSellingProducts } from "../../common/data/dashboardEcommerce";

const BestSellingProducts = () => {
  const { t } = useTranslation();

  return (
    <React.Fragment>
      <Col xl={6}>
        <Card>
          <CardHeader className="align-items-center d-flex">
            <h4 className="card-title mb-0 flex-grow-1">
              {t("product.dashboard.bestSelling.title")}
            </h4>
            <div className="flex-shrink-0">
              <UncontrolledDropdown className="card-header-dropdown" direction="start">
                <DropdownToggle tag="a" className="text-reset" role="button">
                  <span className="fw-semibold text-uppercase fs-12">
                    {t("product.dashboard.sortBy")}:{" "}
                  </span>
                  <span className="text-muted">
                    {t("product.dashboard.period.today")}
                    <i className="mdi mdi-chevron-down ms-1"></i>
                  </span>
                </DropdownToggle>
                <DropdownMenu className="dropdown-menu-end">
                  <DropdownItem>{t("product.dashboard.period.today")}</DropdownItem>
                  <DropdownItem>{t("product.dashboard.period.yesterday")}</DropdownItem>
                  <DropdownItem>{t("product.dashboard.period.last7Days")}</DropdownItem>
                  <DropdownItem>{t("product.dashboard.period.last30Days")}</DropdownItem>
                  <DropdownItem>{t("product.dashboard.period.thisMonth")}</DropdownItem>
                  <DropdownItem>{t("product.dashboard.period.lastMonth")}</DropdownItem>
                </DropdownMenu>
              </UncontrolledDropdown>
            </div>
          </CardHeader>

          <CardBody>
            <div className="table-responsive table-card">
              <table className="table table-hover table-centered align-middle table-nowrap mb-0">
                <tbody>
                  {(bestSellingProducts || []).map((item, key) => (
                    <tr key={key}>
                      <td>
                        <div className="d-flex align-items-center">
                          <div className="avatar-sm bg-light rounded p-1 me-2">
                            <img src={item.img} alt="" className="img-fluid d-block" />
                          </div>
                          <div>
                            <h5 className="fs-14 my-1">
                              <Link to="/apps-ecommerce-product-details" className="text-reset">
                                {item.label}
                              </Link>
                            </h5>
                            <span className="text-muted">{item.date}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <h5 className="fs-14 my-1 fw-normal">${item.price}</h5>
                        <span className="text-muted">{t("product.dashboard.table.price")}</span>
                      </td>
                      <td>
                        <h5 className="fs-14 my-1 fw-normal">{item.orders}</h5>
                        <span className="text-muted">{t("product.dashboard.table.orders")}</span>
                      </td>
                      <td>
                        <h5 className="fs-14 my-1 fw-normal">
                          {item.stock ? (
                            item.stock
                          ) : (
                            <span className="badge bg-danger-subtle text-danger">
                              {t("product.dashboard.outOfStock")}
                            </span>
                          )}{" "}
                        </h5>
                        <span className="text-muted">{t("product.dashboard.table.stock")}</span>
                      </td>
                      <td>
                        <h5 className="fs-14 my-1 fw-normal">${item.amount}</h5>
                        <span className="text-muted">{t("product.dashboard.table.amount")}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="align-items-center mt-4 pt-2 justify-content-between row text-center text-sm-start">
              <div className="col-sm">
                <div className="text-muted">
                  {t("product.dashboard.pagination.summary", { shown: 5, total: 25 })}
                </div>
              </div>
              <div className="col-sm-auto mt-3 mt-sm-0">
                <ul className="pagination pagination-separated pagination-sm mb-0 justify-content-center">
                  <li className="page-item disabled">
                    <Link to="#" className="page-link">
                      ←
                    </Link>
                  </li>
                  <li className="page-item">
                    <Link to="#" className="page-link">
                      1
                    </Link>
                  </li>
                  <li className="page-item active">
                    <Link to="#" className="page-link">
                      2
                    </Link>
                  </li>
                  <li className="page-item">
                    <Link to="#" className="page-link">
                      3
                    </Link>
                  </li>
                  <li className="page-item">
                    <Link to="#" className="page-link">
                      →
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </CardBody>
        </Card>
      </Col>
    </React.Fragment>
  );
};

export default BestSellingProducts;
