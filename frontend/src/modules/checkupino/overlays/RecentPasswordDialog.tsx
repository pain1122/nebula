import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import type { RecentPasswordPrompt, RecentPasswordPromptRequest } from "../auth/recentPassword";
import { ErrorState } from "../feedback";
import { TextField } from "../forms";
import type { ProductLocale } from "../preferences/localization";
import { Dialog } from "./Overlay";

interface PendingPrompt {
  readonly abort?: () => void;
  readonly request: RecentPasswordPromptRequest;
  readonly resolve: (password: string | null) => void;
}

export interface RecentPasswordDialogPrompt {
  readonly cancel: () => void;
  readonly prompt: RecentPasswordPrompt;
  readonly request: RecentPasswordPromptRequest | null;
  readonly submit: (password: string) => void;
}

export const useRecentPasswordDialogPrompt = (): RecentPasswordDialogPrompt => {
  const pendingRef = useRef<PendingPrompt | null>(null);
  const [request, setRequest] = useState<RecentPasswordPromptRequest | null>(null);

  const settle = useCallback((password: string | null) => {
    const pending = pendingRef.current;
    if (!pending) return;

    if (pending.abort) pending.request.signal?.removeEventListener("abort", pending.abort);
    pendingRef.current = null;
    setRequest(null);
    pending.resolve(password);
  }, []);

  const prompt = useMemo<RecentPasswordPrompt>(
    () => ({
      requestPassword: (nextRequest) => {
        if (nextRequest.signal?.aborted) return Promise.resolve(null);

        const previous = pendingRef.current;
        if (previous) {
          if (previous.abort) previous.request.signal?.removeEventListener("abort", previous.abort);
          previous.resolve(null);
        }

        return new Promise<string | null>((resolve) => {
          const abort = nextRequest.signal ? () => settle(null) : undefined;
          pendingRef.current = { abort, request: nextRequest, resolve };
          if (abort) nextRequest.signal?.addEventListener("abort", abort, { once: true });
          setRequest(nextRequest);
        });
      },
    }),
    [settle],
  );

  useEffect(
    () => () => {
      const pending = pendingRef.current;
      if (!pending) return;

      if (pending.abort) pending.request.signal?.removeEventListener("abort", pending.abort);
      pendingRef.current = null;
      pending.resolve(null);
    },
    [],
  );

  return {
    cancel: () => settle(null),
    prompt,
    request,
    submit: (password) => settle(password),
  };
};

interface PasswordCopy {
  readonly action: string;
  readonly cancel: string;
  readonly description: string;
  readonly passwordError: string;
  readonly passwordLabel: string;
  readonly title: string;
}

const passwordCopy: Readonly<Record<ProductLocale, PasswordCopy>> = {
  en: {
    action: "Confirm password",
    cancel: "Cancel",
    description: "Enter your current password to continue this sensitive operation.",
    passwordError: "Enter your current password.",
    passwordLabel: "Current password",
    title: "Confirm your identity",
  },
  fa: {
    action: "تأیید رمز عبور",
    cancel: "انصراف",
    description: "برای ادامه این عملیات حساس، رمز عبور فعلی خود را وارد کنید.",
    passwordError: "رمز عبور فعلی را وارد کنید.",
    passwordLabel: "رمز عبور فعلی",
    title: "تأیید هویت",
  },
};

export interface RecentPasswordDialogProps {
  readonly locale?: ProductLocale;
  readonly onCancel: () => void;
  readonly onSubmit: (password: string) => void;
  readonly request: RecentPasswordPromptRequest | null;
}

const requestKeys = new WeakMap<object, number>();
let nextRequestKey = 1;

const requestKey = (request: RecentPasswordPromptRequest) => {
  const existing = requestKeys.get(request);
  if (existing) return existing;

  const created = nextRequestKey;
  nextRequestKey += 1;
  requestKeys.set(request, created);
  return created;
};

const OpenRecentPasswordDialog = ({
  locale = "fa",
  onCancel,
  onSubmit,
  request,
}: Omit<RecentPasswordDialogProps, "request"> & {
  readonly request: RecentPasswordPromptRequest;
}) => {
  const copy = passwordCopy[locale];
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password) {
      setPasswordError(copy.passwordError);
      return;
    }

    setPassword("");
    setPasswordError(null);
    onSubmit(password);
  };

  const cancel = () => {
    setPassword("");
    setPasswordError(null);
    onCancel();
  };

  return (
    <Dialog
      description={copy.description}
      footer={
        <>
          <button className="btn btn-light" onClick={cancel} type="button">
            {copy.cancel}
          </button>
          <button className="btn btn-primary" form="recent-password-form" type="submit">
            {copy.action}
          </button>
        </>
      }
      initialFocusRef={passwordRef}
      locale={locale}
      onClose={cancel}
      open
      title={copy.title}
    >
      <form id="recent-password-form" noValidate onSubmit={submit}>
        <TextField
          autoComplete="current-password"
          errorMessages={passwordError ? [passwordError] : []}
          id="recent-password"
          label={copy.passwordLabel}
          name="password"
          onChange={(event) => setPassword(event.currentTarget.value)}
          ref={passwordRef}
          required
          type="password"
          value={password}
        />
        <ErrorState error={request.requirement} locale={locale} />
      </form>
    </Dialog>
  );
};

export const RecentPasswordDialog = ({ request, ...props }: RecentPasswordDialogProps) =>
  request ? (
    <OpenRecentPasswordDialog key={requestKey(request)} request={request} {...props} />
  ) : null;
