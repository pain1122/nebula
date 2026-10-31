import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { changeProductLanguage } from "../../i18n";
import Revenue from "./Revenue";

type RevenueSeries = readonly {
  readonly data: readonly number[];
  readonly name: string;
}[];

vi.mock("./DashboardEcommerceCharts", () => ({
  RevenueCharts: ({ series }: { series: RevenueSeries }) => (
    <output data-testid="revenue-series">{JSON.stringify(series)}</output>
  ),
}));

const renderedSeries = () =>
  JSON.parse(screen.getByTestId("revenue-series").textContent ?? "[]") as RevenueSeries;

describe("vanilla dashboard revenue data", () => {
  beforeEach(async () => {
    await changeProductLanguage("en");
  });

  it("switches between the original local fixture series without Redux or network state", () => {
    render(<Revenue />);

    expect(renderedSeries()[0].data[0]).toBe(34);
    expect(renderedSeries()[0].name).toBe("Orders");

    fireEvent.click(screen.getByRole("button", { name: "1M" }));

    expect(renderedSeries()[0].data[0]).toBe(54);
    expect(renderedSeries()[1].data[0]).toBe(89.25);
  });
});
