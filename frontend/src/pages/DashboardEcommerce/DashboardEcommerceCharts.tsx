import React from "react";
import { useTranslation } from "react-i18next";
import ReactApexChart from "Components/Common/LegacyApexChart";
import getChartColorsArray from "../../Components/Common/ChartsDynamicColor";

const RevenueCharts = ({ dataColors, series, categories, countsOnly = false }: any) => {
  const { t, i18n } = useTranslation();
  var linechartcustomerColors = getChartColorsArray(dataColors);

  var options = {
    chart: {
      height: 370,
      type: "line",
      toolbar: {
        show: false,
      },
    },
    stroke: {
      curve: "straight",
      dashArray: [0, 0, 8],
      width: [2, 0, 2.2],
    },
    fill: {
      opacity: [0.1, 0.9, 1],
    },
    markers: {
      size: [0, 0, 0],
      strokeWidth: 2,
      hover: {
        size: 4,
      },
    },
    xaxis: {
      categories: categories ?? [
        t("product.calendar.month.jan"),
        t("product.calendar.month.feb"),
        t("product.calendar.month.mar"),
        t("product.calendar.month.apr"),
        t("product.calendar.month.may"),
        t("product.calendar.month.jun"),
        t("product.calendar.month.jul"),
        t("product.calendar.month.aug"),
        t("product.calendar.month.sep"),
        t("product.calendar.month.oct"),
        t("product.calendar.month.nov"),
        t("product.calendar.month.dec"),
      ],
      axisTicks: {
        show: false,
      },
      axisBorder: {
        show: false,
      },
    },
    grid: {
      show: true,
      xaxis: {
        lines: {
          show: true,
        },
      },
      yaxis: {
        lines: {
          show: false,
        },
      },
      padding: {
        top: 0,
        right: -2,
        bottom: 15,
        left: 10,
      },
    },
    legend: {
      show: true,
      horizontalAlign: "center",
      offsetX: 0,
      offsetY: -5,
      markers: {
        width: 9,
        height: 9,
        radius: 6,
      },
      itemMargin: {
        horizontal: 10,
        vertical: 0,
      },
    },
    plotOptions: {
      bar: {
        columnWidth: "30%",
        barHeight: "70%",
      },
    },
    colors: linechartcustomerColors,
    tooltip: {
      shared: true,
      y: countsOnly
        ? {
            formatter: (value: number) =>
              new Intl.NumberFormat(i18n.resolvedLanguage === "fa" ? "fa-IR" : "en-US").format(
                value,
              ),
          }
        : [
            {
              formatter: function (y: any) {
                if (typeof y !== "undefined") {
                  return y.toFixed(0);
                }
                return y;
              },
            },
            {
              formatter: function (y: any) {
                if (typeof y !== "undefined") {
                  return "$" + y.toFixed(2) + "k";
                }
                return y;
              },
            },
            {
              formatter: function (y: any) {
                if (typeof y !== "undefined") {
                  return t("product.dashboard.chart.salesValue", { count: y.toFixed(0) });
                }
                return y;
              },
            },
          ],
    },
  };
  return (
    <React.Fragment>
      <ReactApexChart
        dir="ltr"
        options={options}
        series={series}
        type="line"
        height="370"
        className="apex-charts"
      />
    </React.Fragment>
  );
};

const StoreVisitsCharts = ({ dataColors, values, labels }: any) => {
  const { t } = useTranslation();
  var chartDonutBasicColors = getChartColorsArray(dataColors);

  const series = values ?? [44, 55, 41, 17, 15];
  var options = {
    labels: labels ?? [
      t("product.dashboard.visit.direct"),
      t("product.dashboard.visit.social"),
      t("product.dashboard.visit.email"),
      t("product.dashboard.visit.other"),
      t("product.dashboard.visit.referrals"),
    ],
    chart: {
      height: 333,
      type: "donut",
    },
    legend: {
      position: "bottom",
    },
    stroke: {
      show: false,
    },
    dataLabels: {
      dropShadow: {
        enabled: false,
      },
    },
    colors: chartDonutBasicColors,
  };
  return (
    <React.Fragment>
      <ReactApexChart
        dir="ltr"
        options={options}
        series={series}
        type="donut"
        height="333"
        className="apex-charts"
      />
    </React.Fragment>
  );
};

export { RevenueCharts, StoreVisitsCharts };
