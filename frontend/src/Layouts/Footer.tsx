import { useTranslation } from "react-i18next";
import { Col, Container, Row } from "reactstrap";

const Footer = () => {
  const { t } = useTranslation();

  return (
    <footer className="footer">
      <Container fluid>
        <Row>
          <Col sm={6}>{t("product.footer.copyright", { year: new Date().getFullYear() })}</Col>
          <Col sm={6}>
            <div className="text-sm-end d-none d-sm-block">{t("product.footer.credit")}</div>
          </Col>
        </Row>
      </Container>
    </footer>
  );
};

export default Footer;
