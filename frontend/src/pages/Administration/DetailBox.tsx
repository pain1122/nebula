import type { ReactNode } from "react";
import { Card, CardBody, CardHeader, Col } from "reactstrap";

export default function DetailBox({
  id,
  title,
  icon,
  columns = 6,
  fields,
  actions,
  children,
  answer = false,
}: {
  readonly id: string;
  readonly title: ReactNode;
  readonly icon: string;
  readonly columns?: 4 | 6 | 12;
  readonly fields?: readonly (readonly [string, ReactNode])[];
  readonly actions?: ReactNode;
  readonly children?: ReactNode;
  readonly answer?: boolean;
}) {
  return (
    <Col lg={columns} md={columns === 12 ? 12 : 6} className="d-flex">
      <Card
        tag="section"
        className="flex-fill"
        aria-labelledby={id}
        data-questionnaire-answer={answer ? "true" : undefined}
      >
        <CardHeader className="d-flex align-items-center flex-wrap gap-2">
          <h5 id={id} className="card-title mb-0 d-flex align-items-center gap-2 flex-grow-1">
            <span aria-hidden="true" className={icon} />
            {title}
          </h5>
          {actions}
        </CardHeader>
        <CardBody>
          {fields ? (
            <dl className="row mb-0">
              {fields.map(([label, value]) => (
                <div key={label} className="col-sm-6 mb-3">
                  <dt className="text-muted small fw-normal mb-1">{label}</dt>
                  <dd className="fw-medium mb-0 text-break">
                    <bdi>{value}</bdi>
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
          {children}
        </CardBody>
      </Card>
    </Col>
  );
}
