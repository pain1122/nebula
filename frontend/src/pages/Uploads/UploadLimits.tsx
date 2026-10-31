import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Col, Container, Row } from "reactstrap";

import BreadCrumb from "../../Components/Common/BreadCrumb";
import { useShellAuth } from "../../Layouts/ShellAuthContext";
import { ErrorState, LoadingState } from "../../modules/checkupino/feedback";
import { normalizeProductLocale } from "../../modules/checkupino/preferences/localization";
import { useUploadSettingQuery } from "../../modules/checkupino/query/api";
import { uploadSettingKeys, type UploadSettingKey } from "../../modules/checkupino/uploads/policy";
import { UploadPolicyCard } from "../../modules/checkupino/uploads/UploadPolicyCard";

const PolicySection = ({ settingKey }: { readonly settingKey: UploadSettingKey }) => {
  const { i18n } = useTranslation();
  const { currentData, error, refetch } = useUploadSettingQuery(settingKey, {
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true,
  });
  if (!currentData)
    return error ? (
      <ErrorState
        error={error}
        locale={normalizeProductLocale(i18n.resolvedLanguage)}
        onRetry={() => void refetch()}
      />
    ) : (
      <LoadingState locale={normalizeProductLocale(i18n.resolvedLanguage)} />
    );
  return <UploadPolicyCard setting={currentData} reload={() => refetch().unwrap()} />;
};

const UploadLimits = () => {
  const { t } = useTranslation();
  const { capabilities, userProfile } = useShellAuth();
  useEffect(() => {
    document.title = t("uploads.title");
  }, [t]);
  return (
    <div className="page-content">
      <Container fluid>
        <BreadCrumb title={t("uploads.title")} pageTitle={t("product.navigation.productAdmin")} />
        <p className="text-muted">{t("uploads.description")}</p>
        {capabilities.managePlatformConfiguration && userProfile ? (
          <Row key={`${userProfile.id}:${userProfile.roles.join(",")}`}>
            {uploadSettingKeys.map((key) => (
              <Col lg={6} key={key}>
                <PolicySection settingKey={key} />
              </Col>
            ))}
          </Row>
        ) : (
          <div className="alert alert-danger" role="alert">
            {t("uploads.rootOnly")}
          </div>
        )}
      </Container>
    </div>
  );
};
export default UploadLimits;
