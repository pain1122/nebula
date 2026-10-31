import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  CardBody,
  Col,
  Container,
  Form,
  FormFeedback,
  Input,
  Label,
  Row,
  Spinner,
} from "reactstrap";

import withRouter from "../../Components/Common/withRouter";
import { useProfile } from "../../Components/Hooks/UserHooks";
import logoLight from "../../assets/images/logo-light.png";
import {
  AdminAccessDeniedError,
  adminAuthAuthority,
} from "../../modules/checkupino/auth/authority";
import { mapServerValidation } from "../../modules/checkupino/forms";
import ParticlesAuth from "../AuthenticationInner/ParticlesAuth";

interface LoginValues {
  readonly email: string;
  readonly password: string;
  readonly remember: boolean;
}

interface LoginFieldErrors {
  email?: readonly string[];
  password?: readonly string[];
}

const Login = (props: any) => {
  const { t } = useTranslation();
  const { authError, denial, userProfile } = useProfile();
  const [values, setValues] = useState<LoginValues>({ email: "", password: "", remember: false });
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [requestError, setRequestError] = useState<unknown>(null);
  const [passwordShow, setPasswordShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = t("product.auth.pageTitle");
    return () => {
      document.title = previousTitle;
    };
  }, [t]);

  useEffect(() => {
    const from = props.router.location.state?.from;
    if (from?.pathname) {
      adminAuthAuthority.rememberRedirectIntent(
        `${from.pathname}${from.search || ""}${from.hash || ""}`,
      );
    }
  }, [props.router.location.state]);

  useEffect(() => {
    if (userProfile) {
      props.router.navigate(adminAuthAuthority.consumeRedirectIntent(), { replace: true });
    }
  }, [props.router.navigate, userProfile]);

  const visibleError = useMemo(() => {
    if (denial === "non-admin" || requestError instanceof AdminAccessDeniedError) {
      return t("product.auth.nonAdmin");
    }
    const error = requestError ?? authError;
    return error instanceof Error ? error.message : error ? String(error) : null;
  }, [authError, denial, requestError, t]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const nextErrors: LoginFieldErrors = {};
    if (!values.email.trim()) nextErrors.email = [t("product.auth.emailRequired")];
    if (!values.password) nextErrors.password = [t("product.auth.passwordRequired")];
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    setFieldErrors({});
    setRequestError(null);
    setSubmitting(true);
    try {
      await adminAuthAuthority.login({
        email: values.email.trim(),
        password: values.password,
        remember: values.remember,
      });
      props.router.navigate(adminAuthAuthority.consumeRedirectIntent(), { replace: true });
    } catch (error: unknown) {
      const validation = mapServerValidation(error, ["email", "password"] as const);
      setFieldErrors(validation?.fieldErrors ?? {});
      setRequestError(error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ParticlesAuth>
      <div className="auth-page-content">
        <Container>
          <Row>
            <Col lg={12}>
              <div className="text-center mt-sm-5 mb-4 text-white-50">
                <div>
                  <Link to="/" className="d-inline-block auth-logo">
                    <img src={logoLight} alt={t("product.brand")} height="20" />
                  </Link>
                </div>
                <p className="mt-3 fs-15 fw-medium">{t("product.auth.logoTagline")}</p>
              </div>
            </Col>
          </Row>

          <Row className="justify-content-center">
            <Col md={8} lg={6} xl={5}>
              <Card className="mt-4">
                <CardBody className="p-4">
                  <div className="text-center mt-2">
                    <h5 className="text-primary">{t("product.auth.title")}</h5>
                    <p className="text-muted">{t("product.auth.intro")}</p>
                  </div>
                  {visibleError ? (
                    <Alert color="danger" transition={{ timeout: 150 }}>
                      {visibleError}
                    </Alert>
                  ) : null}
                  <div className="p-2 mt-4">
                    <Form onSubmit={submit} action="#" noValidate>
                      <div className="mb-3">
                        <Label htmlFor="email" className="form-label">
                          {t("product.auth.email")}
                        </Label>
                        <Input
                          autoComplete="username"
                          className="form-control"
                          id="email"
                          invalid={Boolean(fieldErrors.email?.length)}
                          name="email"
                          onChange={(event) => {
                            const email = event.currentTarget.value;
                            setValues((current) => ({ ...current, email }));
                          }}
                          placeholder={t("product.auth.emailPlaceholder")}
                          type="email"
                          value={values.email}
                        />
                        {fieldErrors.email?.map((message) => (
                          <FormFeedback key={message}>{message}</FormFeedback>
                        ))}
                      </div>

                      <div className="mb-3">
                        <div className="float-end">
                          <Link to="/forgot-password" className="text-muted">
                            {t("product.auth.forgotPassword")}
                          </Link>
                        </div>
                        <Label className="form-label" htmlFor="password-input">
                          {t("product.auth.password")}
                        </Label>
                        <div className="position-relative auth-pass-inputgroup mb-3">
                          <Input
                            autoComplete="current-password"
                            className="form-control pe-5"
                            id="password-input"
                            invalid={Boolean(fieldErrors.password?.length)}
                            name="password"
                            onChange={(event) => {
                              const password = event.currentTarget.value;
                              setValues((current) => ({ ...current, password }));
                            }}
                            placeholder={t("product.auth.passwordPlaceholder")}
                            type={passwordShow ? "text" : "password"}
                            value={values.password}
                          />
                          {fieldErrors.password?.map((message) => (
                            <FormFeedback key={message}>{message}</FormFeedback>
                          ))}
                          <button
                            aria-label={
                              passwordShow
                                ? t("product.auth.hidePassword")
                                : t("product.auth.showPassword")
                            }
                            className="btn btn-link position-absolute end-0 top-0 text-decoration-none text-muted"
                            id="password-addon"
                            onClick={() => setPasswordShow((current) => !current)}
                            type="button"
                          >
                            <i aria-hidden="true" className="ri-eye-fill align-middle" />
                          </button>
                        </div>
                      </div>

                      <div className="form-check">
                        <Input
                          checked={values.remember}
                          className="form-check-input"
                          id="auth-remember-check"
                          name="remember"
                          onChange={(event) => {
                            const remember = event.currentTarget.checked;
                            setValues((current) => ({ ...current, remember }));
                          }}
                          type="checkbox"
                        />
                        <Label className="form-check-label" htmlFor="auth-remember-check">
                          {t("product.auth.remember")}
                        </Label>
                      </div>

                      <div className="mt-4">
                        <Button
                          color="success"
                          disabled={submitting}
                          className="btn btn-success w-100"
                          type="submit"
                        >
                          {submitting ? <Spinner size="sm" className="me-2" /> : null}
                          {submitting ? t("product.auth.submitting") : t("product.auth.submit")}
                        </Button>
                      </div>
                    </Form>
                  </div>
                </CardBody>
              </Card>

              <div className="mt-4 text-center">
                <p className="mb-0">
                  {t("product.auth.signupQuestion")}{" "}
                  <Link
                    to="/register"
                    className="fw-semibold text-primary text-decoration-underline"
                  >
                    {t("product.auth.signup")}
                  </Link>
                </p>
              </div>
            </Col>
          </Row>
        </Container>
      </div>
    </ParticlesAuth>
  );
};

export default withRouter(Login);
