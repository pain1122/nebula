import React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Card, CardBody, Row } from "reactstrap";
import ReviewSlider from "../../Components/Common/ReviewSlider";

//import images
import product8 from "../../assets/images/products/img-8.png";
import product2 from "../../assets/images/products/img-2.png";
import product10 from "../../assets/images/products/img-10.png";
import avatar2 from "../../assets/images/users/avatar-2.jpg";
import avatar3 from "../../assets/images/users/avatar-3.jpg";
import gitbox from "../../assets/images/giftbox.png";

//SimpleBar
import SimpleBar from "simplebar-react";
import { topCategories } from "../../common/data/dashboardEcommerce";

const RecentActivity = (props: any) => {
  const { t } = useTranslation();

  return (
    <React.Fragment>
      <div
        className={
          props.rightColumn
            ? "col-auto layout-rightside-col d-block"
            : "col-auto layout-rightside-col d-none"
        }
        id="layout-rightside-coll"
      >
        <div className="overlay" onClick={props.hideRightColumn}></div>
        <div className="layout-rightside">
          <Card className="h-100 rounded-0">
            <CardBody className="p-0">
              <div className="p-3">
                <h6 className="text-muted mb-0 text-uppercase fw-semibold">
                  {t("product.dashboard.activity.title")}
                </h6>
              </div>
              <SimpleBar style={{ maxHeight: "410px" }} className="p-3 pt-0">
                <div className="acitivity-timeline acitivity-main">
                  <div className="acitivity-item d-flex">
                    <div className="flex-shrink-0 avatar-xs acitivity-avatar">
                      <div className="avatar-title bg-success-subtle text-success rounded-circle">
                        <i className="ri-shopping-cart-2-line"></i>
                      </div>
                    </div>
                    <div className="flex-grow-1 ms-3">
                      <h6 className="mb-1 lh-base">{t("product.dashboard.activity.purchase")}</h6>
                      <p className="text-muted mb-1">
                        {t("product.dashboard.activity.purchaseProduct")}{" "}
                      </p>
                      <small className="mb-0 text-muted">
                        {t("product.dashboard.activity.purchaseTime")}
                      </small>
                    </div>
                  </div>
                  <div className="acitivity-item py-3 d-flex">
                    <div className="flex-shrink-0 avatar-xs acitivity-avatar">
                      <div className="avatar-title bg-danger-subtle text-danger rounded-circle">
                        <i className="ri-stack-fill"></i>
                      </div>
                    </div>
                    <div className="flex-grow-1 ms-3">
                      <h6 className="mb-1 lh-base">
                        {t("product.dashboard.activity.addedNew")}{" "}
                        <span className="fw-semibold">
                          {t("product.dashboard.activity.styleCollection")}
                        </span>
                      </h6>
                      <p className="text-muted mb-1">{t("product.dashboard.activity.byNesta")}</p>
                      <div className="d-inline-flex gap-2 border border-dashed p-2 mb-2">
                        <Link to="/apps-ecommerce-product-details" className="bg-light rounded p-1">
                          <img src={product8} alt="" className="img-fluid d-block" />
                        </Link>
                        <Link to="/apps-ecommerce-product-details" className="bg-light rounded p-1">
                          <img src={product2} alt="" className="img-fluid d-block" />
                        </Link>
                        <Link to="/apps-ecommerce-product-details" className="bg-light rounded p-1">
                          <img src={product10} alt="" className="img-fluid d-block" />
                        </Link>
                      </div>
                      <p className="mb-0 text-muted">
                        <small>{t("product.dashboard.activity.collectionTime")}</small>
                      </p>
                    </div>
                  </div>
                  <div className="acitivity-item py-3 d-flex">
                    <div className="flex-shrink-0">
                      <img
                        src={avatar2}
                        alt=""
                        className="avatar-xs rounded-circle acitivity-avatar"
                      />
                    </div>
                    <div className="flex-grow-1 ms-3">
                      <h6 className="mb-1 lh-base">
                        {t("product.dashboard.activity.likedProducts")}
                      </h6>
                      <p className="text-muted mb-1">
                        {t("product.dashboard.activity.likeDescription")}
                      </p>
                      <small className="mb-0 text-muted">25 Dec, 2021</small>
                    </div>
                  </div>
                  <div className="acitivity-item py-3 d-flex">
                    <div className="flex-shrink-0">
                      <div className="avatar-xs acitivity-avatar">
                        <div className="avatar-title rounded-circle bg-secondary">
                          <i className="mdi mdi-sale fs-14"></i>
                        </div>
                      </div>
                    </div>
                    <div className="flex-grow-1 ms-3">
                      <h6 className="mb-1 lh-base">
                        {t("product.dashboard.activity.offersBy")}{" "}
                        <Link to="/apps-ecommerce-seller-details" className="link-secondary">
                          Digitech Galaxy
                        </Link>
                      </h6>
                      <p className="text-muted mb-2">
                        {t("product.dashboard.activity.offerDescription")}
                      </p>
                      <small className="mb-0 text-muted">12 Dec, 2021</small>
                    </div>
                  </div>
                  <div className="acitivity-item py-3 d-flex">
                    <div className="flex-shrink-0">
                      <div className="avatar-xs acitivity-avatar">
                        <div className="avatar-title rounded-circle bg-danger-subtle text-danger">
                          <i className="ri-bookmark-fill"></i>
                        </div>
                      </div>
                    </div>
                    <div className="flex-grow-1 ms-3">
                      <h6 className="mb-1 lh-base">
                        {t("product.dashboard.activity.favoriteTitle")}
                      </h6>
                      <p className="text-muted mb-2">
                        {t("product.dashboard.activity.favoriteDescription")}
                      </p>
                      <small className="mb-0 text-muted">25 Nov, 2021</small>
                    </div>
                  </div>
                  <div className="acitivity-item py-3 d-flex">
                    <div className="flex-shrink-0">
                      <div className="avatar-xs acitivity-avatar">
                        <div className="avatar-title rounded-circle bg-secondary">
                          <i className="mdi mdi-sale fs-14"></i>
                        </div>
                      </div>
                    </div>
                    <div className="flex-grow-1 ms-3">
                      <h6 className="mb-1 lh-base">
                        {t("product.dashboard.activity.flashSaleStarting")}{" "}
                        <span className="text-primary">
                          {t("product.dashboard.activity.tomorrow")}
                        </span>
                      </h6>
                      <p className="text-muted mb-0">
                        {t("product.dashboard.activity.flashSaleBy")}{" "}
                        <Link to="#" className="link-secondary fw-medium">
                          Zoetic Fashion
                        </Link>
                      </p>
                      <small className="mb-0 text-muted">22 Oct, 2021</small>
                    </div>
                  </div>
                  <div className="acitivity-item py-3 d-flex">
                    <div className="flex-shrink-0">
                      <div className="avatar-xs acitivity-avatar">
                        <div className="avatar-title rounded-circle bg-info-subtle text-info">
                          <i className="ri-line-chart-line"></i>
                        </div>
                      </div>
                    </div>
                    <div className="flex-grow-1 ms-3">
                      <h6 className="mb-1 lh-base">
                        {t("product.dashboard.activity.monthlyReport")}
                      </h6>
                      <p className="text-muted mb-2">
                        <span className="text-danger">
                          {t("product.dashboard.activity.twoDaysLeft")}
                        </span>{" "}
                        {t("product.dashboard.activity.reportNotification")}{" "}
                        <Link to="#" className="link-warning text-decoration-underline">
                          {t("product.dashboard.activity.reportsBuilder")}
                        </Link>
                      </p>
                      <small className="mb-0 text-muted">15 Oct</small>
                    </div>
                  </div>
                  <div className="acitivity-item d-flex">
                    <div className="flex-shrink-0">
                      <img
                        src={avatar3}
                        alt=""
                        className="avatar-xs rounded-circle acitivity-avatar"
                      />
                    </div>
                    <div className="flex-grow-1 ms-3">
                      <h6 className="mb-1 lh-base">{t("product.dashboard.activity.commented")}</h6>
                      <p className="text-muted mb-2 fst-italic">
                        {t("product.dashboard.activity.comment")}
                      </p>
                      <small className="mb-0 text-muted">26 Aug, 2021</small>
                    </div>
                  </div>
                </div>
              </SimpleBar>

              <div className="p-3 mt-2">
                <h6 className="text-muted mb-3 text-uppercase fw-semibold">
                  {t("product.dashboard.activity.topCategories")}
                </h6>

                <ol className="ps-3 text-muted">
                  {(topCategories || []).map((item, key) => (
                    <li className="py-1" key={key}>
                      <Link to="#" className="text-muted">
                        {item.category} <span className="float-end">({item.total})</span>
                      </Link>
                    </li>
                  ))}
                </ol>
                <div className="mt-3 text-center">
                  <Link to="#" className="text-muted text-decoration-underline">
                    {t("product.dashboard.activity.viewAllCategories")}
                  </Link>
                </div>
              </div>
              <div className="p-3">
                <h6 className="text-muted mb-3 text-uppercase fw-semibold">
                  {t("product.dashboard.activity.productReviews")}
                </h6>
                <ReviewSlider />
              </div>

              <div className="p-3">
                <h6 className="text-muted mb-3 text-uppercase fw-semibold">
                  {t("product.dashboard.activity.customerReviews")}
                </h6>
                <div className="bg-light px-3 py-2 rounded-2 mb-2">
                  <div className="d-flex align-items-center">
                    <div className="flex-grow-1">
                      <div className="fs-16 align-middle text-warning">
                        <i className="ri-star-fill"></i>
                        <i className="ri-star-fill"></i>
                        <i className="ri-star-fill"></i>
                        <i className="ri-star-fill"></i>
                        <i className="ri-star-half-fill"></i>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <h6 className="mb-0">
                        {t("product.dashboard.activity.ratingOutOf", { rating: 4.5, total: 5 })}
                      </h6>
                    </div>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-muted">
                    {t("product.dashboard.activity.total")} <span className="fw-medium">5.50k</span>{" "}
                    {t("product.dashboard.activity.reviews")}
                  </div>
                </div>

                <div className="mt-3">
                  <Row className="align-items-center g-2">
                    <div className="col-auto">
                      <div className="p-1">
                        <h6 className="mb-0">
                          {t("product.dashboard.activity.star", { count: 5 })}
                        </h6>
                      </div>
                    </div>
                    <div className="col">
                      <div className="p-1">
                        <div className="progress animated-progess progress-sm">
                          <div
                            className="progress-bar bg-success"
                            role="progressbar"
                            style={{ width: "50.16%" }}
                          ></div>
                        </div>
                      </div>
                    </div>
                    <div className="col-auto">
                      <div className="p-1">
                        <h6 className="mb-0 text-muted">2758</h6>
                      </div>
                    </div>
                  </Row>

                  <Row className="align-items-center g-2">
                    <div className="col-auto">
                      <div className="p-1">
                        <h6 className="mb-0">
                          {t("product.dashboard.activity.star", { count: 4 })}
                        </h6>
                      </div>
                    </div>
                    <div className="col">
                      <div className="p-1">
                        <div className="progress animated-progess progress-sm">
                          <div
                            className="progress-bar bg-success"
                            role="progressbar"
                            style={{ width: "29.32%" }}
                          ></div>
                        </div>
                      </div>
                    </div>
                    <div className="col-auto">
                      <div className="p-1">
                        <h6 className="mb-0 text-muted">1063</h6>
                      </div>
                    </div>
                  </Row>

                  <Row className="align-items-center g-2">
                    <div className="col-auto">
                      <div className="p-1">
                        <h6 className="mb-0">
                          {t("product.dashboard.activity.star", { count: 3 })}
                        </h6>
                      </div>
                    </div>
                    <div className="col">
                      <div className="p-1">
                        <div className="progress animated-progess progress-sm">
                          <div
                            className="progress-bar bg-warning"
                            role="progressbar"
                            style={{ width: "18.12%" }}
                          ></div>
                        </div>
                      </div>
                    </div>
                    <div className="col-auto">
                      <div className="p-1">
                        <h6 className="mb-0 text-muted">997</h6>
                      </div>
                    </div>
                  </Row>

                  <Row className="align-items-center g-2">
                    <div className="col-auto">
                      <div className="p-1">
                        <h6 className="mb-0">
                          {t("product.dashboard.activity.star", { count: 2 })}
                        </h6>
                      </div>
                    </div>
                    <div className="col">
                      <div className="p-1">
                        <div className="progress animated-progess progress-sm">
                          <div
                            className="progress-bar bg-success"
                            role="progressbar"
                            style={{ width: "4.98%" }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    <div className="col-auto">
                      <div className="p-1">
                        <h6 className="mb-0 text-muted">227</h6>
                      </div>
                    </div>
                  </Row>

                  <Row className="align-items-center g-2">
                    <div className="col-auto">
                      <div className="p-1">
                        <h6 className="mb-0">
                          {t("product.dashboard.activity.star", { count: 1 })}
                        </h6>
                      </div>
                    </div>
                    <div className="col">
                      <div className="p-1">
                        <div className="progress animated-progess progress-sm">
                          <div
                            className="progress-bar bg-danger"
                            role="progressbar"
                            style={{ width: "7.42%" }}
                          ></div>
                        </div>
                      </div>
                    </div>
                    <div className="col-auto">
                      <div className="p-1">
                        <h6 className="mb-0 text-muted">408</h6>
                      </div>
                    </div>
                  </Row>
                </div>
              </div>

              <Card className="sidebar-alert bg-light border-0 text-center mx-4 mb-0 mt-3">
                <CardBody>
                  <img src={gitbox} alt="" />
                  <div className="mt-4">
                    <h5>{t("product.dashboard.activity.inviteSeller")}</h5>
                    <p className="text-muted lh-base">
                      {t("product.dashboard.activity.inviteDescription")}
                    </p>
                    <button type="button" className="btn btn-primary btn-label rounded-pill">
                      <i className="ri-mail-fill label-icon align-middle rounded-pill fs-16 me-2"></i>{" "}
                      {t("product.dashboard.activity.inviteNow")}
                    </button>
                  </div>
                </CardBody>
              </Card>
            </CardBody>
          </Card>
        </div>
      </div>
    </React.Fragment>
  );
};

export default RecentActivity;
