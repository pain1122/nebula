import React from "react";
import ReactEcharts from "echarts-for-react";

import "echarts/theme/v5.js";
import "../../assets/scss/plugins/_echarts.scss";

type VelzonEChartProps = Omit<React.ComponentProps<typeof ReactEcharts>, "theme">;

const VelzonEChart = (props: VelzonEChartProps) => <ReactEcharts {...props} theme="v5" />;

export default VelzonEChart;
