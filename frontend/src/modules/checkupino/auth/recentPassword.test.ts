import { describe, expect, it, vi } from "vitest";

import type { TransportAdapter, TransportRequest } from "../../../core";
import { classifyWireFailure, TransportError } from "../api/wire";
import {
  RecentPasswordCancelledError,
  RecentPasswordCoordinator,
  createRecentPasswordGateway,
  isRecentPasswordCancellation,
} from "./recentPassword";
import type { RecentPasswordGateway, RecentPasswordPrompt } from "./recentPassword";

const failure = (status: number) => new TransportError(classifyWireFailure({ status }));

const prompt = (password: string | null = "correct horse battery staple") => ({
  requestPassword: vi.fn<RecentPasswordPrompt["requestPassword"]>(async () => password),
});

const gateway = (): RecentPasswordGateway & { confirm: ReturnType<typeof vi.fn> } => ({
  confirm: vi.fn<RecentPasswordGateway["confirm"]>(async () => ({
    confirmedAt: "2026-08-23T12:00:00Z",
    expiresAt: "2026-08-23T12:15:00Z",
  })),
});

describe("recent password coordinator", () => {
  it("confirms after 423 and retries the exact operation once", async () => {
    const requirement = failure(423);
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(requirement)
      .mockResolvedValueOnce("applied");
    const confirmation = gateway();
    const passwordPrompt = prompt();

    await expect(
      new RecentPasswordCoordinator(confirmation).run(operation, passwordPrompt),
    ).resolves.toBe("applied");
    expect(operation).toHaveBeenCalledTimes(2);
    expect(passwordPrompt.requestPassword).toHaveBeenCalledWith({
      requirement: requirement.wire,
      signal: undefined,
    });
    expect(confirmation.confirm).toHaveBeenCalledOnce();
    expect(confirmation.confirm).toHaveBeenCalledWith("correct horse battery staple", undefined);
  });

  it("never loops when the one permitted retry also returns 423", async () => {
    const operation = vi.fn<() => Promise<void>>(async () => Promise.reject(failure(423)));
    const confirmation = gateway();
    const passwordPrompt = prompt();

    await expect(
      new RecentPasswordCoordinator(confirmation).run(operation, passwordPrompt),
    ).rejects.toMatchObject({ wire: { kind: "recent-password" } });
    expect(operation).toHaveBeenCalledTimes(2);
    expect(passwordPrompt.requestPassword).toHaveBeenCalledOnce();
    expect(confirmation.confirm).toHaveBeenCalledOnce();
  });

  it.each([403, 419, 422])(
    "passes status %s through without prompting or retrying",
    async (status) => {
      const original = failure(status);
      const operation = vi.fn<() => Promise<void>>(async () => Promise.reject(original));
      const confirmation = gateway();
      const passwordPrompt = prompt();

      await expect(
        new RecentPasswordCoordinator(confirmation).run(operation, passwordPrompt),
      ).rejects.toBe(original);
      expect(operation).toHaveBeenCalledOnce();
      expect(passwordPrompt.requestPassword).not.toHaveBeenCalled();
      expect(confirmation.confirm).not.toHaveBeenCalled();
    },
  );

  it("cancels without confirming or applying a retry", async () => {
    const operation = vi.fn<() => Promise<void>>(async () => Promise.reject(failure(423)));
    const confirmation = gateway();

    const outcome = new RecentPasswordCoordinator(confirmation).run(operation, prompt(null));

    await expect(outcome).rejects.toBeInstanceOf(RecentPasswordCancelledError);
    await expect(outcome).rejects.toSatisfy(isRecentPasswordCancellation);
    expect(operation).toHaveBeenCalledOnce();
    expect(confirmation.confirm).not.toHaveBeenCalled();
  });

  it("honors AbortSignal cancellation while the prompt is open", async () => {
    const controller = new AbortController();
    const operation = vi.fn<() => Promise<void>>(async () => Promise.reject(failure(423)));
    const confirmation = gateway();
    const passwordPrompt: RecentPasswordPrompt = {
      requestPassword: async () => {
        controller.abort();
        return "password";
      },
    };

    await expect(
      new RecentPasswordCoordinator(confirmation).run(operation, passwordPrompt, {
        signal: controller.signal,
      }),
    ).rejects.toBeInstanceOf(RecentPasswordCancelledError);
    expect(operation).toHaveBeenCalledOnce();
    expect(confirmation.confirm).not.toHaveBeenCalled();
  });
});

describe("recent password gateway", () => {
  it("preserves the exact session confirmation path and payload", async () => {
    const requests: TransportRequest[] = [];
    const transport: TransportAdapter = {
      async request<TData>(request: TransportRequest) {
        requests.push(request);
        return {
          data: {
            data: {
              confirmed_at: "2026-08-23T12:00:00Z",
              expires_at: "2026-08-23T12:15:00Z",
            },
            message: "Password confirmed.",
            meta: { api_version: "1" },
            success: true,
          } as TData,
          headers: {},
          status: 200,
        };
      },
    };

    await expect(createRecentPasswordGateway(transport).confirm("secret")).resolves.toEqual({
      confirmedAt: "2026-08-23T12:00:00Z",
      expiresAt: "2026-08-23T12:15:00Z",
    });
    expect(requests).toEqual([
      {
        body: { password: "secret" },
        method: "POST",
        path: "/api/auth/confirm-password",
        signal: undefined,
      },
    ]);
  });
});
