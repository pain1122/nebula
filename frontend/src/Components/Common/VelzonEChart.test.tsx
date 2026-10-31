import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("echarts/theme/v5.js", () => ({}));
vi.mock("echarts-for-react", () => ({
  default: ({ theme }: { theme?: string }) => <div data-testid="echart" data-theme={theme} />,
}));

import VelzonEChart from "./VelzonEChart";

describe("VelzonEChart", () => {
  it("forces the official v5 compatibility theme during the ECharts 6 migration", () => {
    render(<VelzonEChart option={{}} />);

    expect(screen.getByTestId("echart")).toHaveAttribute("data-theme", "v5");
  });
});
