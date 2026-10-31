import React from "react";
import { useTranslation } from "react-i18next";
import { SwiperSlide } from "swiper/react";
import Swiper from "./DirectionalSwiper";
import { Card, CardBody } from "reactstrap";

import companies1 from "../../assets/images/companies/img-1.png";
import companies8 from "../../assets/images/companies/img-8.png";
import avatar2 from "../../assets/images/users/avatar-2.jpg";
import avatar3 from "../../assets/images/users/avatar-3.jpg";

import "swiper/css";
import "swiper/css/pagination";

// import required modules
// import {
//   // Autoplay,
//   Mousewheel } from "swiper";

const ReviewSlider = () => {
  const { t } = useTranslation();

  return (
    <Swiper
      direction={"vertical"}
      slidesPerView={2}
      spaceBetween={10}
      mousewheel={true}
      loop={true}
      autoplay={{
        delay: 2000,
        disableOnInteraction: false,
      }}
      // modules={[
      // Autoplay,
      // Mousewheel]}
      className="mySwiper vertical-swiper"
      style={{ height: "250px" }}
    >
      <SwiperSlide>
        <Card className="border border-dashed shadow-none">
          <CardBody>
            <div className="d-flex">
              <div className="flex-shrink-0 avatar-sm">
                <div className="avatar-title bg-light rounded">
                  <img src={companies1} alt="" height="30" />
                </div>
              </div>
              <div className="flex-grow-1 ms-3">
                <div>
                  <p className="text-muted mb-1 fst-italic text-truncate-two-lines">
                    {t("product.dashboard.review.first")}
                  </p>
                  <div className="fs-11 align-middle text-warning">
                    <i className="ri-star-fill"></i>
                    <i className="ri-star-fill"></i>
                    <i className="ri-star-fill"></i>
                    <i className="ri-star-fill"></i>
                    <i className="ri-star-fill"></i>
                  </div>
                </div>
                <div className="text-end mb-0 text-muted">
                  {t("product.dashboard.review.by")}{" "}
                  <cite title={t("product.dashboard.review.sourceTitle")}>Force Medicines</cite>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      </SwiperSlide>
      <SwiperSlide>
        <Card className="border border-dashed shadow-none">
          <CardBody>
            <div className="d-flex">
              <div className="flex-shrink-0">
                <img src={avatar3} alt="" className="avatar-sm rounded" />
              </div>
              <div className="flex-grow-1 ms-3">
                <div>
                  <p className="text-muted mb-1 fst-italic text-truncate-two-lines">
                    {t("product.dashboard.review.second")}
                  </p>
                  <div className="fs-11 align-middle text-warning">
                    <i className="ri-star-fill"></i>
                    <i className="ri-star-fill"></i>
                    <i className="ri-star-fill"></i>
                    <i className="ri-star-fill"></i>
                    <i className="ri-star-half-fill"></i>
                  </div>
                </div>
                <div className="text-end mb-0 text-muted">
                  {t("product.dashboard.review.by")}{" "}
                  <cite title={t("product.dashboard.review.sourceTitle")}>Henry Baird</cite>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      </SwiperSlide>
      <SwiperSlide>
        <Card className="border border-dashed shadow-none">
          <CardBody>
            <div className="d-flex">
              <div className="flex-shrink-0 avatar-sm">
                <div className="avatar-title bg-light rounded">
                  <img src={companies8} alt="" height="30" />
                </div>
              </div>
              <div className="flex-grow-1 ms-3">
                <div>
                  <p className="text-muted mb-1 fst-italic text-truncate-two-lines">
                    {t("product.dashboard.review.third")}
                  </p>
                  <div className="fs-11 align-middle text-warning">
                    <i className="ri-star-fill"></i>
                    <i className="ri-star-fill"></i>
                    <i className="ri-star-fill"></i>
                    <i className="ri-star-line"></i>
                    <i className="ri-star-line"></i>
                  </div>
                </div>
                <div className="text-end mb-0 text-muted">
                  {t("product.dashboard.review.by")}{" "}
                  <cite title={t("product.dashboard.review.sourceTitle")}>Zoetic Fashion</cite>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      </SwiperSlide>
      <SwiperSlide>
        <Card className="border border-dashed shadow-none">
          <CardBody>
            <div className="d-flex">
              <div className="flex-shrink-0">
                <img src={avatar2} alt="" className="avatar-sm rounded" />
              </div>
              <div className="flex-grow-1 ms-3">
                <div>
                  <p className="text-muted mb-1 fst-italic text-truncate-two-lines">
                    {t("product.dashboard.review.fourth")}
                  </p>
                  <div className="fs-11 align-middle text-warning">
                    <i className="ri-star-fill"></i>
                    <i className="ri-star-fill"></i>
                    <i className="ri-star-fill"></i>
                    <i className="ri-star-half-fill"></i>
                    <i className="ri-star-line"></i>
                  </div>
                </div>
                <div className="text-end mb-0 text-muted">
                  {t("product.dashboard.review.by")}{" "}
                  <cite title={t("product.dashboard.review.sourceTitle")}>Nancy Martino</cite>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      </SwiperSlide>
    </Swiper>
  );
};

export default ReviewSlider;
