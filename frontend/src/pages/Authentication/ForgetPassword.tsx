import PropTypes from "prop-types";
import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Row,
  Col,
  Alert,
  Card,
  CardBody,
  Container,
  FormFeedback,
  Input,
  Label,
  Form,
} from "reactstrap";

//redux
import { useSelector, useDispatch } from "react-redux";

import { Link } from "react-router-dom";
import withRouter from "../../Components/Common/withRouter";

// Formik Validation
import * as Yup from "yup";
import { useFormik } from "formik";

// action
// ForgetPassword.tsx
import { userForgetPassword } from "../../slices/auth/forgetpwd/thunk";
// import images
// import profile from "../../assets/images/bg.png";
import logoLight from "../../assets/images/logo-light.png";
import ParticlesAuth from "../AuthenticationInner/ParticlesAuth";
import { createSelector } from "reselect";
import type { AppDispatch } from "../../store";

type ForgetPasswordValues = {
  email: string;
};

type Navigate = (path: string) => void;

const ForgetPasswordPage = (props: any) => {
  const { t } = useTranslation();
  const dispatch: any = useDispatch();

  const validation: any = useFormik({
    // enableReinitialize : use this flag when initial values needs to be changed
    enableReinitialize: true,

    initialValues: {
      email: "",
    },
    validationSchema: Yup.object({
      email: Yup.string().required(t("product.auth.emailRequired")),
    }),
    onSubmit: (values) => {
      dispatch(userForgetPassword(values, props.router.navigate));
    },
  });

  const selectLayoutState = (state: any) => state.ForgetPassword;
  const selectLayoutProperties = createSelector(selectLayoutState, (state) => ({
    forgetError: state.forgetError,
    forgetSuccessMsg: state.forgetSuccessMsg,
  }));
  // Inside your component
  const { forgetError, forgetSuccessMsg } = useSelector(selectLayoutProperties);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = t("product.forgot.pageTitle");
    return () => {
      document.title = previousTitle;
    };
  }, [t]);

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
                    <h5 className="text-primary">{t("product.forgot.title")}</h5>
                    <p className="text-muted">{t("product.forgot.intro")}</p>

                    <i className="ri-mail-send-line display-5 text-success mb-3"></i>
                  </div>

                  <Alert className="border-0 alert-warning text-center mb-2 mx-2" role="alert">
                    {t("product.forgot.instructions")}
                  </Alert>
                  <div className="p-2">
                    {forgetError && forgetError ? (
                      <Alert color="danger" style={{ marginTop: "13px" }}>
                        {forgetError}
                      </Alert>
                    ) : null}
                    {forgetSuccessMsg ? (
                      <Alert color="success" style={{ marginTop: "13px" }}>
                        {forgetSuccessMsg}
                      </Alert>
                    ) : null}
                    <Form
                      onSubmit={(e: any) => {
                        e.preventDefault();
                        validation.handleSubmit();
                        return false;
                      }}
                    >
                      <div className="mb-4">
                        <Label className="form-label">{t("product.auth.email")}</Label>
                        <Input
                          name="email"
                          className="form-control"
                          placeholder={t("product.auth.emailPlaceholder")}
                          type="email"
                          onChange={validation.handleChange}
                          onBlur={validation.handleBlur}
                          value={validation.values.email || ""}
                          invalid={
                            validation.touched.email && validation.errors.email ? true : false
                          }
                        />
                        {validation.touched.email && validation.errors.email ? (
                          <FormFeedback type="invalid">
                            <div>{validation.errors.email}</div>
                          </FormFeedback>
                        ) : null}
                      </div>

                      <div className="text-center mt-4">
                        <button className="btn btn-info w-100" type="submit">
                          {t("product.forgot.submit")}
                        </button>
                      </div>
                    </Form>
                  </div>
                </CardBody>
              </Card>

              <div className="mt-4 text-center">
                <p className="mb-0">
                  {t("product.forgot.rememberPrompt")}{" "}
                  <Link to="/login" className="fw-semibold text-primary text-decoration-underline">
                    {t("product.forgot.backToLogin")}
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

ForgetPasswordPage.propTypes = {
  history: PropTypes.object,
};

export default withRouter(ForgetPasswordPage);
