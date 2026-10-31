import React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Card, CardBody, CardHeader, Col, DropdownItem, DropdownToggle, UncontrolledDropdown } from "reactstrap";
import DropdownMenu from "../../Components/Common/DirectionalDropdownMenu";
import { topSellers } from "../../common/data/dashboardEcommerce";

const TopSellers = () => {
  const { t } = useTranslation();

  return (
    <React.Fragment>
      <Col xl={6}>
        <Card className="card-height-100">
          <CardHeader className="align-items-center d-flex">
            <h4 className="card-title mb-0 flex-grow-1">
              {t("product.dashboard.topSellers.title")}
            </h4>
            <div className="flex-shrink-0">
              <UncontrolledDropdown className="card-header-dropdown" direction="start">
                <DropdownToggle tag="a" className="text-reset dropdown-btn" role="button">
                  <span className="text-muted">
                    {t("product.dashboard.report")}
                    <i className="mdi mdi-chevron-down ms-1"></i>
                  </span>
                </DropdownToggle>
                <DropdownMenu className="dropdown-menu dropdown-menu-end">
                  <DropdownItem>{t("product.dashboard.downloadReport")}</DropdownItem>
                  <DropdownItem>{t("product.dashboard.export")}</DropdownItem>
                  <DropdownItem>{t("product.dashboard.import")}</DropdownItem>
                </DropdownMenu>
              </UncontrolledDropdown>
            </div>
          </CardHeader>

          <CardBody>
            <div className="table-responsive table-card">
              <table className="table table-centered table-hover align-middle table-nowrap mb-0">
                <tbody>
                  {topSellers.map((item, key) => (
                    <tr key={key}>
                      <td>
                        <div className="d-flex align-items-center">
                          <div className="flex-shrink-0 me-2">
                            <img src={item.img} alt="" className="avatar-sm p-2" />
                          </div>
                          <div>
                            <h5 className="fs-14 my-1 fw-medium">
                              <Link to="/apps-ecommerce-seller-details" className="text-reset">
                                {item.label}
                              </Link>
                            </h5>
                            <span className="text-muted">{item.name}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="text-muted">{item.product}</span>
                      </td>
                      <td>
                        <p className="mb-0">{item.stock}</p>
                        <span className="text-muted">{t("product.dashboard.table.stock")}</span>
                      </td>
                      <td>
                        <span className="text-muted">${item.amount}</span>
                      </td>
                      <td>
                        <h5 className="fs-14 mb-0">
                          {item.percentage}%
                          <i className="ri-bar-chart-fill text-success fs-16 align-middle ms-2"></i>
                        </h5>
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

export default TopSellers;
