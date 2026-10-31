import ReactApexChart, { type Props as ReactApexChartProps } from "react-apexcharts";

type LegacyApexChartProps = Omit<ReactApexChartProps, "options"> & {
  options: unknown;
};

/**
 * Compatibility boundary for retained Velzon examples whose option literals
 * predate the typed react-apexcharts contract. New product code must import
 * react-apexcharts directly and provide an ApexOptions-compatible object.
 */
const LegacyApexChart = ({ options, ...props }: LegacyApexChartProps) => (
  <ReactApexChart {...props} options={options as ReactApexChartProps["options"]} />
);

export default LegacyApexChart;
