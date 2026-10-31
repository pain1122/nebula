import { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { useTranslation } from "react-i18next";

import {
  isRecentPasswordCancellation,
  RecentPasswordCoordinator,
  recentPasswordGateway,
} from "../auth/recentPassword";
import { ErrorState, LoadingState } from "../feedback";
import {
  applyServerValidationToForm,
  DateField,
  fieldErrorMessages,
  mapServerValidation,
  SelectField,
  TextareaField,
  TextField,
  useSchemaForm,
} from "../forms";
import { Dialog, RecentPasswordDialog, useRecentPasswordDialogPrompt } from "../overlays";
import { normalizeProductLocale } from "../preferences/localization";
import { checkupinoApi, useAdminUserQuery } from "../query/api";
import {
  createUserEditorSchema,
  suggestUserPassword,
  userEditorDefaults,
  userEditorFields,
  userWriteGateway,
  type AdminUser,
  type UserEditorValues,
} from "./editor";

export interface UserEditorProps {
  readonly staffOnly?: boolean;
  readonly manageAdminIdentities: boolean;
  readonly onClose: () => void;
  readonly onSaved: (user: AdminUser) => void;
  readonly userId: number | null;
}

const UserEditorForm = ({
  staffOnly = false,
  manageAdminIdentities,
  onClose,
  onSaved,
  user,
}: Omit<UserEditorProps, "userId"> & { readonly user?: AdminUser }) => {
  const { t, i18n } = useTranslation();
  const locale = normalizeProductLocale(i18n.resolvedLanguage);
  const creating = !user;
  const schema = useMemo(
    () => createUserEditorSchema(t, creating, manageAdminIdentities, user?.role, staffOnly),
    [t, creating, manageAdminIdentities, user?.role, staffOnly],
  );
  const form = useSchemaForm(schema, {
    defaultValues: {
      ...userEditorDefaults(user),
      ...(staffOnly && !user ? { role: "admin" } : {}),
    },
  });
  const dispatch = useDispatch();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const [confirmationFailure, setConfirmationFailure] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const operation = useRef<AbortController | null>(null);
  const invalidField = useRef<(typeof userEditorFields)[number] | null>(null);
  const { setFocus } = form;
  const passwordPrompt = useRecentPasswordDialogPrompt();
  const role = form.watch("role");
  const needsReason = role === "admin" || user?.role === "admin";

  useEffect(() => {
    if (!busy && invalidField.current) {
      setFocus(invalidField.current);
      invalidField.current = null;
    }
  }, [busy, setFocus]);

  useEffect(
    () => () => {
      operation.current?.abort();
    },
    [],
  );

  const save = async (values: UserEditorValues) => {
    if (operation.current) return;
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true);
    setFailure(null);
    setConfirmationFailure(false);
    let failedConfirmation = false;
    const coordinator = new RecentPasswordCoordinator({
      async confirm(password, signal) {
        try {
          return await recentPasswordGateway.confirm(password, signal);
        } catch (error: unknown) {
          failedConfirmation = true;
          throw error;
        }
      },
    });
    try {
      const saved = await coordinator.run(
        () => userWriteGateway.save(values, user?.id ?? null, controller.signal),
        passwordPrompt.prompt,
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      form.reset();
      dispatch(
        checkupinoApi.util.invalidateTags([
          { type: "AdminUsers", id: "LIST" },
          { type: "AdminUsers", id: saved.id },
        ]),
      );
      onSaved(saved);
    } catch (error: unknown) {
      if (controller.signal.aborted || isRecentPasswordCancellation(error)) return;
      setFailure(error);
      setConfirmationFailure(failedConfirmation);
      if (!failedConfirmation) {
        const validation = mapServerValidation(error, userEditorFields);
        if (validation) {
          applyServerValidationToForm(validation, userEditorFields, form.setError);
          invalidField.current =
            userEditorFields.find((name) => validation.fieldErrors[name]?.length) ?? null;
        }
      }
    } finally {
      operation.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  const close = () => {
    if (!busy) {
      form.reset();
      onClose();
    }
  };
  const field = (name: (typeof userEditorFields)[number], required = false) => ({
    ...form.register(name),
    errorMessages: fieldErrorMessages(form.formState.errors[name]),
    id: `user-${name}`,
    label: t(`users.field.${name}`),
    locale,
    required,
  });
  const roles = staffOnly
    ? ["admin"]
    : ["patient", "doctor", ...(manageAdminIdentities ? ["admin"] : [])];
  const states = ["free", "trial", "active", "expired", "suspended"];

  return (
    <>
      <Dialog
        busy={busy}
        locale={locale}
        onClose={close}
        open={!passwordPrompt.request}
        title={t(creating ? "users.createTitle" : "users.editTitle")}
        footer={
          <>
            <button className="btn btn-light" disabled={busy} onClick={close} type="button">
              {t("users.cancel")}
            </button>
            <button
              className="btn btn-primary"
              disabled={busy}
              form="user-editor-form"
              type="submit"
            >
              {t(busy ? "users.saving" : creating ? "users.create" : "users.save")}
            </button>
          </>
        }
      >
        <form
          id="user-editor-form"
          noValidate
          onSubmit={(event) => {
            void form.handleSubmit(save)(event);
          }}
        >
          {confirmationFailure ? (
            <p className="text-danger" role="alert">
              {t("users.confirmationFailed")}
            </p>
          ) : null}
          {failure ? <ErrorState error={failure} locale={locale} /> : null}
          <fieldset disabled={busy}>
            <TextField {...field("first_name", true)} autoComplete="given-name" maxLength={100} />
            <TextField {...field("last_name", true)} autoComplete="family-name" maxLength={100} />
            <TextField {...field("email", true)} autoComplete="off" maxLength={255} type="email" />
            <TextField
              {...field("phone", true)}
              autoComplete="off"
              maxLength={30}
              normalizeDigits
              type="tel"
            />
            <DateField {...field("birth_date", true)} />
            <TextField {...field("NID", true)} autoComplete="off" maxLength={10} normalizeDigits />
            <SelectField
              {...field("role", true)}
              options={roles.map((value) => ({ value, label: t(`users.role.${value}`) }))}
            />
            {role === "patient" ? (
              <SelectField
                {...field("patient_status")}
                options={states.map((value) => ({ value, label: t(`users.patient.${value}`) }))}
              />
            ) : null}
            <TextField {...field("city")} maxLength={120} />
            <TextField {...field("country")} maxLength={120} />
            <TextField {...field("zip_code")} maxLength={20} normalizeDigits />
            <TextareaField {...field("bio")} maxLength={2000} rows={3} />
            {creating ? (
              <>
                <TextField
                  {...field("password", true)}
                  autoComplete="new-password"
                  helpText={t("users.passwordHelp")}
                  maxLength={64}
                  type={showPassword ? "text" : "password"}
                />
                <TextField
                  {...field("password_confirmation", true)}
                  autoComplete="new-password"
                  maxLength={64}
                  type={showPassword ? "text" : "password"}
                />
                <div className="d-flex gap-2 mb-3">
                  <button
                    className="btn btn-light"
                    onClick={() => {
                      const suggested = suggestUserPassword();
                      form.setValue("password", suggested, { shouldValidate: true });
                      form.setValue("password_confirmation", suggested, { shouldValidate: true });
                      setShowPassword(true);
                    }}
                    type="button"
                  >
                    {t("users.suggestPassword")}
                  </button>
                  <button
                    aria-pressed={showPassword}
                    className="btn btn-light"
                    onClick={() => setShowPassword(!showPassword)}
                    type="button"
                  >
                    {t(showPassword ? "users.hidePassword" : "users.showPassword")}
                  </button>
                </div>
              </>
            ) : (
              <p className="text-muted">{t("users.passwordUnchanged")}</p>
            )}
            {needsReason ? (
              <TextareaField
                {...field("reason", true)}
                helpText={t("users.reasonHelp")}
                maxLength={1000}
                rows={3}
              />
            ) : null}
          </fieldset>
        </form>
      </Dialog>
      <RecentPasswordDialog
        locale={locale}
        onCancel={passwordPrompt.cancel}
        onSubmit={passwordPrompt.submit}
        request={passwordPrompt.request}
      />
    </>
  );
};

export const UserEditor = (props: UserEditorProps) => {
  const { t, i18n } = useTranslation();
  const locale = normalizeProductLocale(i18n.resolvedLanguage);
  const { currentData, error, isFetching, refetch } = useAdminUserQuery(props.userId ?? 0, {
    skip: props.userId === null,
    refetchOnMountOrArgChange: true,
  });
  if (props.userId === null) return <UserEditorForm {...props} />;
  if (currentData && !isFetching && !(currentData.role === "admin" && !props.manageAdminIdentities))
    return <UserEditorForm {...props} user={currentData} />;
  return (
    <Dialog locale={locale} onClose={props.onClose} open title={t("users.editTitle")}>
      {isFetching ? (
        <LoadingState locale={locale} />
      ) : (
        <ErrorState
          error={error}
          locale={locale}
          onRetry={() => {
            void refetch();
          }}
        />
      )}
    </Dialog>
  );
};
