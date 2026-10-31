import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useProfile } from "../../Components/Hooks/UserHooks";
import { Container, Row, Col, Card, CardBody, Label, Input, FormFeedback, Form } from "reactstrap";

// Formik Validation
import * as Yup from "yup";
import { useFormik } from "formik";

import avatar from "../../assets/images/users/avatar-1.jpg";

const UserProfile = () => {
  const { t } = useTranslation();
  const { userProfile, loading } = useProfile();

  const userName = userProfile?.name || t("product.role.admin");
  const email = userProfile?.email || "";
  const idx = userProfile?.id ? String(userProfile.id) : "1";

  const validation: any = useFormik({
    // enableReinitialize : use this flag when initial values needs to be changed
    enableReinitialize: true,

    initialValues: {
      first_name: userName || t("product.role.admin"),
      idx: idx || "",
    },
    validationSchema: Yup.object({
      first_name: Yup.string().required(t("product.profile.usernameRequired")),
    }),
    onSubmit: () => {
      // Profile editing will be connected to Laravel profile API later.
    },
  });

  useEffect(() => {
    const previousTitle = document.title;
    document.title = t("product.profile.pageTitle");
    return () => {
      document.title = previousTitle;
    };
  }, [t]);

  if (loading) {
    return null;
  }

  return (
    <React.Fragment>
      <div className="page-content">
        <Container fluid>
          <Row>
            <Col lg="12">
              <p className="text-muted mb-0">{t("product.profile.editingUnavailable")}</p>

              <Card>
                <CardBody>
                  <div className="d-flex">
                    <div className="mx-3">
                      <img
                        src={avatar}
                        alt={t("product.profile.avatarAlt")}
                        className="avatar-md rounded-circle img-thumbnail"
                      />
                    </div>
                    <div className="flex-grow-1 align-self-center">
                      <div className="text-muted">
                        <h5>{userName || t("product.role.admin")}</h5>
                        <p className="mb-1">{t("product.profile.emailId", { email })}</p>
                        <p className="mb-0">{t("product.profile.idNumber", { id: idx })}</p>
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </Col>
          </Row>

          <h4 className="card-title mb-4">{t("product.profile.changeUsername")}</h4>

          <Card>
            <CardBody>
              <Form
                className="form-horizontal"
                onSubmit={(e: any) => {
                  e.preventDefault();
                  validation.handleSubmit();
                  return false;
                }}
              >
                <div className="form-group">
                  <Label className="form-label">{t("product.profile.username")}</Label>
                  <Input
                    name="first_name"
                    // value={name}
                    className="form-control"
                    placeholder={t("product.profile.usernamePlaceholder")}
                    type="text"
                    onChange={validation.handleChange}
                    onBlur={validation.handleBlur}
                    value={validation.values.first_name || ""}
                    invalid={
                      validation.touched.first_name && validation.errors.first_name ? true : false
                    }
                  />
                  {validation.touched.first_name && validation.errors.first_name ? (
                    <FormFeedback type="invalid">{validation.errors.first_name}</FormFeedback>
                  ) : null}
                  <Input name="idx" value={idx} type="hidden" />
                </div>
              </Form>
            </CardBody>
          </Card>
        </Container>
      </div>
    </React.Fragment>
  );
};

export default UserProfile;
