import React from 'react';
import ReactApexChart from "Components/Common/LegacyApexChart";

import getChartColorsArray from "../../Components/Common/ChartsDynamicColor";

const SimpleDonutCharts = ({ dataColors, values, labels, height = 330 }: {
    dataColors: string;
    values?: number[];
    labels?: string[];
    height?: number;
    className?: string;
    dir?: string;
}) => {
    var chartDonutBasicColors = getChartColorsArray(dataColors);
    const series = values ?? [27.01, 20.87, 33.54, 37.58]
    var options = {
        chart: {
            height,
            type: 'donut',
        },
        labels: labels ?? ["Documents", "Media", "Others", "Free Space"],
        dataLabels: {
            dropShadow: {
                enabled: false,
              }
        },
        legend: {
            position: 'bottom'
        },
        colors: chartDonutBasicColors
    };
    return (
        <ReactApexChart dir="ltr"
            series={series}
            options={options}
            type="donut"
            height={height}
            className="apex-charts mt-3"
        />

    )
}

export default SimpleDonutCharts;
