import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  RecentPasswordCoordinator,
  isRecentPasswordCancellation,
  type RecentPasswordGateway,
} from "../auth/recentPassword";
import { classifyWireFailure, TransportError } from "../api/wire";
import { RecentPasswordDialog, useRecentPasswordDialogPrompt } from "./RecentPasswordDialog";

const recentPasswordFailure = () =>
  new TransportError(classifyWireFailure({ data: { message: "Password required." }, status: 423 }));

interface FixtureProps {
  readonly coordinator: RecentPasswordCoordinator;
  readonly operation: () => Promise<string>;
  readonly signal?: AbortSignal;
}

const Fixture = ({ coordinator, operation, signal }: FixtureProps) => {
  const passwordPrompt = useRecentPasswordDialogPrompt();
  const [outcome, setOutcome] = useState("idle");

  const start = () => {
    void coordinator
      .run(operation, passwordPrompt.prompt, { signal })
      .then(setOutcome)
      .catch((error: unknown) =>
        setOutcome(isRecentPasswordCancellation(error) ? "cancelled" : "failed"),
      );
  };

  return (
    <>
      <button onClick={start} type="button">
        شروع
      </button>
      <output>{outcome}</output>
      <RecentPasswordDialog
        onCancel={passwordPrompt.cancel}
        onSubmit={passwordPrompt.submit}
        request={passwordPrompt.request}
      />
    </>
  );
};

const gateway = () => ({
  confirm: vi.fn<RecentPasswordGateway["confirm"]>(async () => ({
    confirmedAt: "2026-08-27T00:00:00Z",
    expiresAt: "2026-08-27T00:15:00Z",
  })),
});

describe("recent-password dialog prompt", () => {
  it("keeps password ephemeral and lets F13 confirm then retry exactly once", async () => {
    const user = userEvent.setup();
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(recentPasswordFailure())
      .mockResolvedValueOnce("applied");
    const confirmation = gateway();
    render(
      <Fixture coordinator={new RecentPasswordCoordinator(confirmation)} operation={operation} />,
    );

    await user.click(screen.getByRole("button", { name: "شروع" }));
    const password = await screen.findByLabelText(/رمز عبور فعلی/);
    expect(password).toHaveFocus();

    await user.type(password, "secret-password");
    await user.click(screen.getByRole("button", { name: "تأیید رمز عبور" }));

    expect(await screen.findByText("applied")).toBeVisible();
    expect(confirmation.confirm).toHaveBeenCalledWith("secret-password", undefined);
    expect(operation).toHaveBeenCalledTimes(2);
    expect(screen.queryByLabelText(/رمز عبور فعلی/)).not.toBeInTheDocument();
  });

  it("cancels without confirmation or retry", async () => {
    const user = userEvent.setup();
    const operation = vi.fn<() => Promise<string>>(async () =>
      Promise.reject(recentPasswordFailure()),
    );
    const confirmation = gateway();
    render(
      <Fixture coordinator={new RecentPasswordCoordinator(confirmation)} operation={operation} />,
    );

    await user.click(screen.getByRole("button", { name: "شروع" }));
    await user.click(await screen.findByRole("button", { name: "انصراف" }));

    expect(await screen.findByText("cancelled")).toBeVisible();
    expect(confirmation.confirm).not.toHaveBeenCalled();
    expect(operation).toHaveBeenCalledOnce();
  });

  it("settles and closes when the caller aborts while the prompt is open", async () => {
    const user = userEvent.setup();
    const controller = new AbortController();
    const operation = vi.fn<() => Promise<string>>(async () =>
      Promise.reject(recentPasswordFailure()),
    );
    render(
      <Fixture
        coordinator={new RecentPasswordCoordinator(gateway())}
        operation={operation}
        signal={controller.signal}
      />,
    );

    await user.click(screen.getByRole("button", { name: "شروع" }));
    expect(await screen.findByRole("dialog", { name: "تأیید هویت" })).toBeVisible();
    controller.abort();

    expect(await screen.findByText("cancelled")).toBeVisible();
    expect(screen.queryByRole("dialog", { name: "تأیید هویت" })).not.toBeInTheDocument();
  });
});
