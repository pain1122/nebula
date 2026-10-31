import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { toast } from "react-toastify";

import { classifyWireFailure } from "../api/wire";
import { FeedbackToastViewport, notifyErrorToast, notifyFeedbackToast } from "./Toast";

afterEach(() => {
  toast.dismiss();
});

describe("feedback toast boundary", () => {
  it("publishes Farsi-first status feedback only after an imperative call", async () => {
    const { container } = render(<FeedbackToastViewport locale="fa" />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    act(() => {
      notifyFeedbackToast({ tone: "success" });
    });

    expect(await screen.findByRole("status")).toHaveTextContent("عملیات با موفقیت انجام شد.");
    expect(container.querySelector(".Toastify__toast-container--rtl")).toBeInTheDocument();
  });

  it("uses an alert with the preserved server message and support reference", async () => {
    render(<FeedbackToastViewport locale="en" />);
    const wire = classifyWireFailure({
      data: { message: "Backend detail remains visible." },
      headers: { "x-correlation-id": "request-789" },
      status: 500,
    });

    act(() => {
      notifyErrorToast(wire, "en");
    });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Backend detail remains visible.");
    expect(alert).toHaveTextContent("Tracking ID: request-789");
  });

  it("does not publish cancelled requests", () => {
    render(<FeedbackToastViewport />);

    expect(notifyErrorToast(classifyWireFailure({ cancelled: true }))).toBeNull();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
