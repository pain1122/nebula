import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardBody, CardHeader, Col, Row } from "reactstrap";
import { RevenueCharts } from "./DashboardEcommerceCharts";
import CountUp from "react-countup";
import {
  allRevenueData,
  halfYearRevenueData,
  monthRevenueData,
  yearRevenueData,
} from "../../common/data/dashboardEcommerce";

type RevenuePeriod = "all" | "month" | "halfyear" | "year";

const revenueByPeriod = {
  all: allRevenueData,
  month: monthRevenueData,
  halfyear: halfYearRevenueData,
  year: yearRevenueData,
} satisfies Record<RevenuePeriod, typeof allRevenueData>;

const Revenue = () => {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<RevenuePeriod>("all");
  const chartData = revenueByPeriod[period];

  const localizedChartData = useMemo(
    () =>
      Array.isArray(chartData)
        ? chartData.map((item, index) => ({
            ...item,
            name: t(`product.dashboard.revenue.series.${index}`),
          }))
        : chartData,
    [chartData, t],
  );

  return (
    <React.Fragment>
      <Card>
        <CardHeader className="border-0 align-items-center d-flex">
          <h4 className="card-title mb-0 flex-grow-1">{t("product.dashboard.revenue.title")}</h4>
          <div className="d-flex gap-1">
            <button
              type="button"
              className="btn btn-soft-secondary btn-sm"
              onClick={() => {
                setPeriod("all");
              }}
            >
              {t("product.dashboard.period.all")}
            </button>
            <button
              type="button"
              className="btn btn-soft-secondary btn-sm"
              onClick={() => {
                setPeriod("month");
              }}
            >
              {t("product.dashboard.period.oneMonth")}
            </button>
            <button
              type="button"
              className="btn btn-soft-secondary btn-sm"
              onClick={() => {
                setPeriod("halfyear");
              }}
            >
              {t("product.dashboard.period.sixMonths")}
            </button>
            <button
              type="button"
              className="btn btn-soft-primary btn-sm"
              onClick={() => {
                setPeriod("year");
              }}
            >
              {t("product.dashboard.period.oneYear")}
            </button>
          </div>
        </CardHeader>

        <CardHeader className="p-0 border-0 bg-light-subtle">
          <Row className="g-0 text-center">
            <Col xs={6} sm={3}>
              <div className="p-3 border border-dashed border-start-0">
                <h5 className="mb-1">
                  <CountUp start={0} end={7585} duration={3} separator="," />
                </h5>
                <p className="text-muted mb-0">{t("product.dashboard.revenue.orders")}</p>
              </div>
            </Col>
            <Col xs={6} sm={3}>
              <div className="p-3 border border-dashed border-start-0">
                <h5 className="mb-1">
                  <CountUp suffix="k" prefix="$" start={0} decimals={2} end={22.89} duration={3} />
                </h5>
                <p className="text-muted mb-0">{t("product.dashboard.revenue.earnings")}</p>
              </div>
            </Col>
            <Col xs={6} sm={3}>
              <div className="p-3 border border-dashed border-start-0">
                <h5 className="mb-1">
                  <CountUp start={0} end={367} duration={3} />
                </h5>
                <p className="text-muted mb-0">{t("product.dashboard.revenue.refunds")}</p>
              </div>
            </Col>
            <Col xs={6} sm={3}>
              <div className="p-3 border border-dashed border-start-0 border-end-0">
                <h5 className="mb-1 text-success">
                  <CountUp start={0} end={18.92} decimals={2} duration={3} suffix="%" />
                </h5>
                <p className="text-muted mb-0">{t("product.dashboard.revenue.conversionRatio")}</p>
              </div>
            </Col>
          </Row>
        </CardHeader>

        <CardBody className="p-0 pb-2">
          <div className="w-100">
            <div dir="ltr">
              <RevenueCharts
                series={localizedChartData}
                dataColors='["--vz-info", "--vz-primary", "--vz-danger"]'
              />
            </div>
          </div>
        </CardBody>
      </Card>
    </React.Fragment>
  );
};

export default Revenue;
