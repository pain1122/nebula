import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

const HarnessSmoke = () => <main aria-label="frontend test harness">Checkupino admin</main>;

describe("frontend test harness", () => {
  it("renders React content in jsdom", () => {
    render(<HarnessSmoke />);

    expect(screen.getByRole("main", { name: "frontend test harness" })).toHaveTextContent(
      "Checkupino admin",
    );
  });
});
