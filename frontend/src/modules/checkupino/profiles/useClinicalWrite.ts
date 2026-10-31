import { useEffect, useRef, useState } from "react";
import { adminAuthAuthority } from "../auth/authority";
import { isRecentPasswordCancellation, recentPasswordCoordinator } from "../auth/recentPassword";
import { TransportError } from "../api/wire";
import { useRecentPasswordDialogPrompt } from "../overlays";
import { clinicalRequest } from "./onboarding";
import type { z } from "../forms";

export function useClinicalRead<T>(path: string, schema: z.ZodType<T>, enabled = true) {
  const owner = adminAuthAuthority.getSnapshot().identity?.id;
  const [generation, setGeneration] = useState(0);
  const key = `${owner}:${path}:${generation}`;
  const [state, setState] = useState<{ key: string; data: T | null; error: boolean } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    if (enabled)
      void clinicalRequest("GET", path, schema, controller.signal)
        .then((data) => {
          if (!controller.signal.aborted) setState({ key, data, error: false });
        })
        .catch(() => {
          if (!controller.signal.aborted) setState({ key, data: null, error: true });
        });
    return () => controller.abort();
  }, [enabled, path, schema, key]);
  return {
    data: enabled && state?.key === key ? state.data : null,
    error: state?.key === key && state.error,
    refetch: () => setGeneration((value) => value + 1),
  };
}

export function useClinicalWrite(key: string) {
  const owner = adminAuthAuthority.getSnapshot().identity?.id;
  const storageKey = `checkupino.clinical.pending.v1.${owner}.${key}`;
  const password = useRecentPasswordDialogPrompt();
  const [busy, setBusy] = useState(false),
    [failure, setFailure] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState(() => {
    try {
      return sessionStorage.getItem(storageKey) === "1";
    } catch {
      return true;
    }
  });
  const operation = useRef<AbortController | null>(null);
  const cancel = useRef(password.cancel);
  useEffect(() => {
    cancel.current = password.cancel;
  }, [password.cancel]);
  useEffect(() => {
    const unsubscribe = adminAuthAuthority.subscribe(() => {
      const fresh = adminAuthAuthority.getSnapshot();
      if (fresh.status !== "authenticated" || fresh.identity?.id !== owner) {
        operation.current?.abort();
        cancel.current();
      }
    });
    return () => {
      unsubscribe();
      operation.current?.abort();
      cancel.current();
    };
  }, [owner]);
  const mark = (pending: boolean) => {
    try {
      if (pending) sessionStorage.setItem(storageKey, "1");
      else sessionStorage.removeItem(storageKey);
    } catch {
      /* Explicit refresh remains required. */
    }
  };
  const refresh = () => {
    mark(false);
    setUncertain(false);
    setFailure(null);
  };
  const run = async <T>(
    read: (signal: AbortSignal) => Promise<{ revision: string }>,
    expected: string,
    save: (signal: AbortSignal) => Promise<T>,
    accepted: (value: T) => void,
  ) => {
    if (busy || uncertain || operation.current) return;
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true);
    setFailure(null);
    let dispatched = false,
      stale = false;
    try {
      let receipt: T | undefined;
      await recentPasswordCoordinator.run(
        async () => {
          const current = await read(controller.signal);
          if (current.revision !== expected) {
            stale = true;
            throw new Error("Revision changed");
          }
          controller.signal.throwIfAborted();
          mark(true);
          dispatched = true;
          receipt = await save(controller.signal);
        },
        password.prompt,
        { signal: controller.signal },
      );
      mark(false);
      if (!controller.signal.aborted && receipt !== undefined) accepted(receipt);
    } catch (error) {
      if (controller.signal.aborted) return;
      if (isRecentPasswordCancellation(error)) {
        mark(false);
        return;
      }
      const definite =
        error instanceof TransportError && [403, 404, 409, 422].includes(error.wire.status ?? 0);
      if (definite) mark(false);
      if (stale || (dispatched && !definite)) setUncertain(true);
      else setFailure("adminManage.rejected");
    } finally {
      operation.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  return { busy, failure, uncertain, refresh, run, password };
}
