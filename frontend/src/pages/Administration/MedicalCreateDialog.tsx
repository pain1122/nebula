import { useState } from "react";
import { useTranslation } from "react-i18next";
import { checkupinoTransport } from "../../modules/checkupino/api/transport";
import ActionDialog from "./ActionDialog";

export default function MedicalCreateDialog({
  onClose,
  onSaved,
  onUncertain,
}: {
  readonly onClose: () => void;
  readonly onSaved: () => void;
  readonly onUncertain: () => void;
}) {
  const { t } = useTranslation();
  const [reservation, setReservation] = useState("");
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [limit, setLimit] = useState(1048576);
  const id = Number(reservation);
  const valid =
    /^\d+$/.test(reservation) &&
    Number.isSafeInteger(id) &&
    id > 0 &&
    !!title.trim() &&
    Number.isInteger(limit) &&
    limit > 0 &&
    limit <= 1048576;
  return (
    <ActionDialog
      valid={valid}
      onClose={onClose}
      onSaved={onSaved}
      onUncertain={onUncertain}
      target={{
        title: t("adminManage.newMedicalRequest"),
        path: "/api/admin/medical-requests",
        method: "POST",
        body: {
          reservation_id: id,
          title: title.trim(),
          instructions: instructions.trim() || null,
          maximum_bytes: limit,
        },
        verify: async (signal) => {
          await checkupinoTransport.request({
            method: "GET",
            path: `/api/admin/reservations/${id}`,
            signal,
          });
        },
      }}
    >
      <label className="form-label d-block" htmlFor="admin-medical-reservation">
        {t("adminManage.reservation_id")}
      </label>
      <input
        id="admin-medical-reservation"
        className="form-control mb-3"
        type="number"
        min={1}
        required
        value={reservation}
        onChange={(event) => setReservation(event.target.value)}
      />
      <label className="form-label d-block" htmlFor="admin-medical-title">
        {t("adminManage.title")}
      </label>
      <input
        id="admin-medical-title"
        className="form-control mb-3"
        required
        maxLength={255}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <label className="form-label d-block" htmlFor="admin-medical-instructions">
        {t("adminManage.instructions")}
      </label>
      <textarea
        id="admin-medical-instructions"
        className="form-control mb-3"
        rows={3}
        maxLength={5000}
        value={instructions}
        onChange={(event) => setInstructions(event.target.value)}
      />
      <label className="form-label d-block" htmlFor="admin-medical-limit">
        {t("adminManage.bytes")}
      </label>
      <input
        id="admin-medical-limit"
        className="form-control mb-3"
        required
        type="number"
        min={1}
        max={1048576}
        step={1}
        value={limit}
        onChange={(event) => setLimit(Number(event.target.value))}
      />
      <p className="text-muted">{t("adminManage.pdfBound")}</p>
    </ActionDialog>
  );
}
