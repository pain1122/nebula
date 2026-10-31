import React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Card, CardBody, CardHeader, Col } from "reactstrap";
import { recentOrders } from "../../common/data/dashboardEcommerce";

const RecentOrders = () => {
  const { t } = useTranslation();

  return (
    <React.Fragment>
      <Col xl={8}>
        <Card>
          <CardHeader className="align-items-center d-flex">
            <h4 className="card-title mb-0 flex-grow-1">
              {t("product.dashboard.recentOrders.title")}
            </h4>
            <div className="flex-shrink-0">
              <button type="button" className="btn btn-soft-info btn-sm">
                <i className="ri-file-list-3-line align-middle"></i>{" "}
                {t("product.dashboard.generateReport")}
              </button>
            </div>
          </CardHeader>

          <CardBody>
            <div className="table-responsive table-card">
              <table className="table table-borderless table-centered align-middle table-nowrap mb-0">
                <thead className="text-muted table-light">
                  <tr>
                    <th scope="col">{t("product.dashboard.table.orderId")}</th>
                    <th scope="col">{t("product.dashboard.table.customer")}</th>
                    <th scope="col">{t("product.dashboard.table.product")}</th>
                    <th scope="col">{t("product.dashboard.table.amount")}</th>
                    <th scope="col">{t("product.dashboard.table.vendor")}</th>
                    <th scope="col">{t("product.dashboard.table.status")}</th>
                    <th scope="col">{t("product.dashboard.table.rating")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(recentOrders || []).map((item, key) => (
                    <tr key={key}>
                      <td>
                        <Link to="/apps-ecommerce-order-details" className="fw-medium link-primary">
                          {item.orderId}
                        </Link>
                      </td>
                      <td>
                        <div className="d-flex align-items-center">
                          <div className="flex-shrink-0 me-2">
                            <img src={item.img} alt="" className="avatar-xs rounded-circle" />
                          </div>
                          <div className="flex-grow-1">{item.name}</div>
                        </div>
                      </td>
                      <td>{item.product}</td>
                      <td>
                        <span className="text-success">${item.amount}.00</span>
                      </td>
                      <td>{item.vendor}</td>
                      <td>
                        <span
                          className={`badge bg-${item.statusClass}-subtle text-${item.statusClass}`}
                        >
                          {t(`product.dashboard.status.${item.status.toLowerCase()}`)}
                        </span>
                      </td>
                      <td>
                        <h5 className="fs-14 fw-medium mb-0">
                          {item.rating}
                          <span className="text-muted fs-11 ms-1">
                            ({t("product.dashboard.votes", { votes: item.votes })})
                          </span>
                        </h5>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </Col>
    </React.Fragment>
  );
};

export default RecentOrders;
