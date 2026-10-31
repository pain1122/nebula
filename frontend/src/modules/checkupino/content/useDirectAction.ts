import { useEffect, useRef, useState } from "react";
import { adminAuthAuthority } from "../auth/authority";
import { TransportError } from "../api/wire";

export interface DirectActionContext {
  readonly signal: AbortSignal;
  readonly dispatch: <T>(mutation: () => Promise<T>) => Promise<T>;
}
// User intent is the original click. Fresh server authority/revisions remain mandatory;
// this coordinator never requests passwords, confirms again or replays uncertain writes.
export function useDirectAction(onUncertain?: () => void) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<"conflict" | "rejected" | "uncertain" | null>(null);
  const operation = useRef<AbortController | null>(null);
  const activeIdentity = useRef<{ id: number | string; roles: string } | null>(null);
  const uncertain = useRef(false);
  useEffect(() => {
    const unsubscribe = adminAuthAuthority.subscribe(() => {
      const current = adminAuthAuthority.getSnapshot().identity,
        original = activeIdentity.current;
      if (original && (current?.id !== original.id || current.roles.join("|") !== original.roles)) {
        operation.current?.abort();
        setBusy(false);
      }
    });
    return () => {
      operation.current?.abort();
      unsubscribe();
    };
  }, []);
  const reset = () => {
    if (operation.current) return;
    uncertain.current = false;
    setFailure(null);
  };
  const run = async (work: (context: DirectActionContext) => Promise<void>) => {
    if (operation.current || uncertain.current) return;
    const controller = new AbortController();
    operation.current = controller;
    const actor = adminAuthAuthority.getSnapshot().identity;
    const identity = actor ? { id: actor.id, roles: actor.roles.join("|") } : null;
    activeIdentity.current = identity;
    setBusy(true);
    setFailure(null);
    let dispatched = false;
    try {
      const dispatch = async <T>(mutation: () => Promise<T>) => {
        const current = adminAuthAuthority.getSnapshot().identity;
        if (
          controller.signal.aborted ||
          !identity ||
          current?.id !== identity.id ||
          current.roles.join("|") !== identity.roles
        )
          throw new DOMException("Session changed", "AbortError");
        dispatched = true;
        return mutation();
      };
      await work({ signal: controller.signal, dispatch });
    } catch (error) {
      if (!controller.signal.aborted) {
        const ambiguous =
          dispatched &&
          (!(error instanceof TransportError) ||
            ["network", "server", "cancelled"].includes(error.wire.kind));
        uncertain.current = ambiguous;
        if (ambiguous) onUncertain?.();
        setFailure(
          ambiguous
            ? "uncertain"
            : error instanceof TransportError && error.wire.status === 409
              ? "conflict"
              : "rejected",
        );
      }
    } finally {
      if (operation.current === controller) {
        operation.current = null;
        activeIdentity.current = null;
      }
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  return { busy, failure, uncertain: failure === "uncertain", run, reset };
}
