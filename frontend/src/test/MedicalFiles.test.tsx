import { configureStore } from "@reduxjs/toolkit";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createInstance } from "i18next";
import { Provider } from "react-redux";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TransportRequest, TransportResponse } from "../core";
import en from "../locales/en.json";
import fa from "../locales/fa.json";
import { classifyWireFailure, TransportError } from "../modules/checkupino/api/wire";
import type {
  DoctorMedicalDetail,
  MedicalRequest,
  MedicalReport,
} from "../modules/checkupino/medical/types";
import { checkupinoApi } from "../modules/checkupino/query/api";
import MedicalFiles, { DoctorMedicalFiles } from "../pages/Medical/MedicalFiles";
import PatientReservations from "../pages/Booking/PatientReservations";
import DoctorReservations from "../pages/Booking/DoctorReservations";

const { execute } = vi.hoisted(() => ({
  execute: vi.fn<(request: TransportRequest) => Promise<TransportResponse<unknown>>>(),
}));
vi.mock("../modules/checkupino/api/transport", async (original) => ({
  ...(await original<typeof import("../modules/checkupino/api/transport")>()),
  checkupinoTransport: {
    request: (request: TransportRequest) =>
      request.path.endsWith("/attachment-options")
        ? Promise.resolve({
            status: 200,
            headers: {},
            data: {
              data: [
                { key: "document", available: true, allowed_mime_types: ["application/pdf"] },
                { key: "media", available: true, allowed_mime_types: ["image/jpeg", "image/png"] },
                { key: "archive", available: false, allowed_mime_types: [] },
                { key: "multimedia", available: false, allowed_mime_types: [] },
              ],
            },
          })
        : execute(request),
  },
}));
const response = (data: unknown): TransportResponse<unknown> => ({
  data: { success: true, data, message: null },
  headers: {},
  status: 200,
});
const medicalRequest = (id = "M1", reservation = "R1", completed = false): MedicalRequest => ({
  public_id: id,
  reservation_public_id: reservation,
  title: `Request ${id}`,
  request_type: "document",
  instructions: "Synthetic instructions",
  status: completed ? "completed" : "open",
  attachment_rules: {
    state: "available",
    field: "file",
    revision: "a".repeat(64),
    issued_revision: "b".repeat(64),
    allowed_mime_types: ["application/pdf"],
    max_bytes_by_mime: { "application/pdf": 1048576 },
  },
  due_at: null,
  reviewed_at: null,
  closed_at: null,
  created_at: null,
});
const report = (id = "M1", published = false): MedicalReport => ({
  public_id: `report-${id}`,
  medical_request_public_id: id,
  status: published ? "published" : "draft",
  body: `<b>Plain report ${id}</b>`,
  body_format: "plain_text",
  author_name: "Synthetic doctor",
  published_at: published ? "2026-10-10T08:00:00Z" : null,
  supersedes_report_public_id: null,
  created_at: null,
});
const file = {
  public_id: "F1",
  label: "Eligible.pdf",
  mime_type: "application/pdf",
  size_bytes: 1048576,
  available: true,
  created_at: null,
};
const storeFor = () =>
  configureStore({
    reducer: { [checkupinoApi.reducerPath]: checkupinoApi.reducer },
    middleware: (defaults) => defaults().concat(checkupinoApi.middleware),
  });
const stores: ReturnType<typeof storeFor>[] = [];
const patientRequest = (): MedicalRequest => ({
  ...medicalRequest(),
  upload_progress: { received_count: 0, awaiting_checks_count: 0 },
});
const syntheticPdf = (bytes = 128) =>
  new File(["x".repeat(bytes)], "synthetic.pdf", { type: "application/pdf" });
const sendUpload = () => fireEvent.submit(screen.getByRole("dialog").querySelector("form")!);
const openUpload = async (locale: "en" | "fa" = "en", chosen = syntheticPdf()) => {
  const view = await renderView("/my/reservations/R1/medical", locale);
  const copy = locale === "en" ? en : fa;
  fireEvent.click(await screen.findByRole("button", { name: copy["medical.uploadFile"] }));
  fireEvent.change(screen.getByLabelText(copy["medical.chooseFile"]), {
    target: { files: [chosen] },
  });
  return view;
};
const renderView = async (path = "/doctor/reservations/R1/medical", locale: "en" | "fa" = "en") => {
  const translations = Object.assign(createInstance(), {
    reportNamespaces: { addUsedNamespaces: () => {}, getUsedNamespaces: () => [] },
  });
  await translations.use(initReactI18next).init({
    lng: locale,
    keySeparator: false,
    interpolation: { escapeValue: false },
    resources: { en: { translation: en }, fa: { translation: fa } },
  });
  const store = storeFor();
  stores.push(store);
  const view = render(
    <Provider store={store}>
      <I18nextProvider i18n={translations}>
        <MemoryRouter initialEntries={[path]}>
          <Link to="/doctor/reservations/R2/medical">Next reservation</Link>
          <Routes>
            <Route path="/my/reservations/:reservationId/medical" element={<MedicalFiles />} />
            <Route
              path="/doctor/reservations/:reservationId/medical"
              element={<DoctorMedicalFiles />}
            />
            <Route path="/my/reservations" element={<PatientReservations />} />
            <Route path="/doctor/reservations" element={<DoctorReservations />} />
          </Routes>
        </MemoryRouter>
      </I18nextProvider>
    </Provider>,
  );
  return { ...view, store };
};
beforeEach(() => {
  execute.mockReset();
});
afterEach(() => {
  for (const store of stores.splice(0)) store.dispatch(checkupinoApi.util.resetApiState());
});

describe("medical review and report controls", () => {
  const detail = (
    status: MedicalRequest["status"] = "open",
    reports: readonly MedicalReport[] = [],
    available = true,
  ): DoctorMedicalDetail => ({
    medical_request: { ...medicalRequest(), status },
    files: available ? [file] : [],
    reports,
  });
  const reads = (state: DoctorMedicalDetail) => (input: TransportRequest) =>
    response(input.path.endsWith("/M1") ? state : [state.medical_request]);
  const submit = () => fireEvent.submit(screen.getByRole("dialog").querySelector("form")!);
  const openReports = async () =>
    fireEvent.click(await screen.findByRole("button", { name: en["medical.reports"] }));

  it.each(["en", "fa"] as const)(
    "starts review after a fresh eligible detail read in %s",
    async (locale) => {
      let state = detail();
      execute.mockImplementation(async (input) => {
        if (input.method === "POST") {
          state = detail("in_review");
          return response({ medical_request: state.medical_request, files: state.files });
        }
        return reads(state)(input);
      });
      await renderView("/doctor/reservations/R1/medical", locale);
      const copy = locale === "en" ? en : fa;
      fireEvent.click(await screen.findByRole("button", { name: copy["medical.startReview"] }));
      expect(screen.getByText(copy["medical.reviewConfirm"])).toBeInTheDocument();
      submit();
      await screen.findByText(copy["medical.actionSaved"]);
      expect(
        execute.mock.calls
          .filter(([input]) => input.method === "POST")
          .map(([input]) => [input.path, input.body]),
      ).toEqual([["/api/doctor/reservations/R1/medical-requests/M1/review", undefined]]);
      expect(
        await screen.findByRole("button", { name: copy["medical.newDraft"] }),
      ).toBeInTheDocument();
    },
  );

  it("hides review with no eligible files and provides only encoded authorized download links", async () => {
    execute.mockImplementation(async (input) => reads(detail())(input));
    const view = await renderView();
    const download = await screen.findByRole("link", { name: en["medical.download"] });
    expect(download).toHaveAttribute(
      "href",
      "http://127.0.0.1:8080/api/doctor/reservations/R1/medical-requests/M1/files/F1/download",
    );
    expect(download).toHaveAttribute("rel", "noopener");
    expect(download).toHaveAttribute("referrerpolicy", "origin");
    view.unmount();
    execute.mockImplementation(async (input) => reads(detail("open", [], false))(input));
    await renderView();
    await screen.findByText(en["medical.noEligibleFiles"]);
    expect(
      screen.queryByRole("button", { name: en["medical.startReview"] }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: en["medical.download"] })).not.toBeInTheDocument();
  });

  it.each(["draft", "edit"])(
    "saves %s plain text through its ordinary whitelisted endpoint",
    async (kind) => {
      let state = detail("in_review", kind === "edit" ? [report()] : []);
      execute.mockImplementation(async (input) => {
        if (input.method !== "GET") {
          const saved = { ...report(), body: "<script>plain text</script>" };
          state = detail("in_review", [saved]);
          return response(saved);
        }
        return reads(state)(input);
      });
      const view = await renderView();
      if (kind === "edit") await openReports();
      fireEvent.click(
        await screen.findByRole("button", {
          name: en[kind === "draft" ? "medical.newDraft" : "medical.editDraft"],
        }),
      );
      fireEvent.change(screen.getByLabelText(en["medical.reportBody"]), {
        target: { value: " <script>plain text</script> " },
      });
      submit();
      await screen.findByText(en["medical.actionSaved"]);
      const write = execute.mock.calls.find(([input]) => input.method !== "GET")?.[0];
      expect(write?.method).toBe(kind === "draft" ? "POST" : "PUT");
      expect(write?.path).toBe(
        "/api/doctor/reservations/R1/medical-requests/M1/reports" +
          (kind === "edit" ? "/report-M1" : ""),
      );
      expect(write?.body).toEqual({ body: "<script>plain text</script>" });
      expect(await screen.findByText("<script>plain text</script>")).toBeInTheDocument();
      expect(view.container.querySelector("pre script")).toBeNull();
    },
  );

  it.each(["empty", "oversize"])(
    "rejects %s report text before a write or preflight",
    async (fault) => {
      execute.mockImplementation(async (input) => reads(detail("in_review"))(input));
      await renderView();
      fireEvent.click(await screen.findByRole("button", { name: en["medical.newDraft"] }));
      const before = execute.mock.calls.length;
      fireEvent.change(screen.getByLabelText(en["medical.reportBody"]), {
        target: { value: fault === "empty" ? "   " : "x".repeat(20001) },
      });
      submit();
      await screen.findByText(en["medical.actionChanged"]);
      expect(execute.mock.calls).toHaveLength(before);
    },
  );

  it("blocks a draft acknowledgement from another request without a success notice", async () => {
    execute.mockImplementation(async (input) =>
      input.method === "POST"
        ? response({ ...report("OTHER"), body: "Synthetic report" })
        : reads(detail("in_review"))(input),
    );
    await renderView();
    fireEvent.click(await screen.findByRole("button", { name: en["medical.newDraft"] }));
    fireEvent.change(screen.getByLabelText(en["medical.reportBody"]), {
      target: { value: "Synthetic report" },
    });
    submit();
    await screen.findByText(en["medical.actionUncertain"]);
    expect(screen.getByRole("button", { name: en["medical.saveDraft"] })).toBeDisabled();
    expect(screen.queryByText(en["medical.actionSaved"])).not.toBeInTheDocument();
    expect(execute.mock.calls.filter(([input]) => input.method === "POST")).toHaveLength(1);
  });

  it("requires publication confirmation with exact saved text and sends no publication facts", async () => {
    let state = detail("in_review", [report()]);
    execute.mockImplementation(async (input) => {
      if (input.method === "POST") {
        state = detail("completed", [report("M1", true)]);
        return response(report("M1", true));
      }
      return reads(state)(input);
    });
    const view = await renderView();
    await openReports();
    fireEvent.click(screen.getByRole("button", { name: en["medical.publishReport"] }));
    const modal = screen.getByRole("dialog");
    expect(within(modal).getByText(en["medical.publishConfirm"])).toBeInTheDocument();
    expect(within(modal).getByText("<b>Plain report M1</b>")).toBeInTheDocument();
    expect(modal.querySelector("pre b")).toBeNull();
    expect(execute.mock.calls.every(([input]) => input.method === "GET")).toBe(true);
    submit();
    await screen.findByText(en["medical.actionSaved"]);
    const writes = execute.mock.calls.filter(([input]) => input.method !== "GET");
    expect(writes).toHaveLength(1);
    expect(writes[0][0]).toMatchObject({
      method: "POST",
      path: "/api/doctor/reservations/R1/medical-requests/M1/reports/report-M1/publish",
    });
    expect(writes[0][0].body).toBeUndefined();
    expect(
      await screen.findByRole("button", { name: en["medical.amendReport"] }),
    ).toBeInTheDocument();
    expect(view.container.querySelector("pre b")).toBeNull();
    expect(screen.queryByRole("button", { name: en["medical.editDraft"] })).not.toBeInTheDocument();
  });

  it("creates a same-request amendment referencing the published predecessor and preserves history", async () => {
    const original = report("M1", true);
    let state = detail("completed", [original]);
    execute.mockImplementation(async (input) => {
      if (input.method === "POST") {
        const draft = {
          ...report(),
          public_id: "amendment",
          body: "Correction",
          supersedes_report_public_id: original.public_id,
        };
        state = detail("completed", [original, draft]);
        return response(draft);
      }
      return reads(state)(input);
    });
    await renderView();
    await openReports();
    fireEvent.click(screen.getByRole("button", { name: en["medical.amendReport"] }));
    fireEvent.change(screen.getByLabelText(en["medical.reportBody"]), {
      target: { value: "Correction" },
    });
    submit();
    await screen.findByText(en["medical.actionSaved"]);
    expect(execute.mock.calls.find(([input]) => input.method === "POST")?.[0].body).toEqual({
      body: "Correction",
      supersedes_report_id: original.public_id,
    });
    expect(await screen.findByText("Correction")).toBeInTheDocument();
    expect(screen.getByText("<b>Plain report M1</b>")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: en["medical.amendReport"] }),
    ).not.toBeInTheDocument();
  });

  it.each(["no-file", "wrong-request", "wrong-reservation", "denied"])(
    "blocks review on %s fresh detail",
    async (fault) => {
      let details = 0;
      execute.mockImplementation(async (input) => {
        if (!input.path.endsWith("/M1")) return response([medicalRequest()]);
        if (++details === 1) return response(detail());
        if (fault === "denied") throw new TransportError(classifyWireFailure({ status: 404 }));
        const fresh = detail("open", [], fault !== "no-file");
        return response({
          ...fresh,
          medical_request: {
            ...fresh.medical_request,
            ...(fault === "wrong-request"
              ? { public_id: "OTHER" }
              : fault === "wrong-reservation"
                ? { reservation_public_id: "OTHER" }
                : {}),
          },
        });
      });
      await renderView();
      fireEvent.click(await screen.findByRole("button", { name: en["medical.startReview"] }));
      submit();
      await waitFor(() => expect(details).toBe(2));
      await waitFor(() =>
        expect(within(screen.getByRole("dialog")).getAllByRole("alert").length).toBeGreaterThan(0),
      );
      expect(execute.mock.calls.every(([input]) => input.method === "GET")).toBe(true);
    },
  );

  it("does not publish a draft changed since the confirmation was opened", async () => {
    let details = 0;
    execute.mockImplementation(async (input) =>
      reads(
        detail("in_review", [
          {
            ...report(),
            body: input.path.endsWith("/M1") && ++details > 1 ? "New text" : report().body,
          },
        ]),
      )(input),
    );
    await renderView();
    await openReports();
    fireEvent.click(screen.getByRole("button", { name: en["medical.publishReport"] }));
    submit();
    await screen.findByText(en["medical.actionChanged"]);
    expect(execute.mock.calls.every(([input]) => input.method === "GET")).toBe(true);
  });

  it("blocks ambiguous report delivery across close/reopen until matching explicit detail refresh", async () => {
    execute.mockImplementation(async (input) => {
      if (input.method === "POST") throw new TransportError(classifyWireFailure({ status: 503 }));
      return reads(detail("in_review"))(input);
    });
    await renderView();
    fireEvent.click(await screen.findByRole("button", { name: en["medical.newDraft"] }));
    fireEvent.change(screen.getByLabelText(en["medical.reportBody"]), {
      target: { value: "Synthetic report" },
    });
    submit();
    await screen.findByText(en["medical.actionUncertain"]);
    expect(screen.getByRole("button", { name: en["medical.saveDraft"] })).toBeDisabled();
    fireEvent.click(
      within(screen.getByRole("dialog")).getByText(en["medical.close"], { selector: "button" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: en["medical.newDraft"] }));
    expect(screen.getByRole("button", { name: en["medical.saveDraft"] })).toBeDisabled();
    fireEvent.click(
      within(screen.getByRole("dialog")).getByText(en["medical.close"], { selector: "button" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: en["medical.refresh"] }));
    fireEvent.click(await screen.findByRole("button", { name: en["medical.newDraft"] }));
    expect(screen.getByRole("button", { name: en["medical.saveDraft"] })).toBeEnabled();
    expect(execute.mock.calls.filter(([input]) => input.method === "POST")).toHaveLength(1);
  });

  it("aborts one pending review on unmount without replay", async () => {
    let signal: AbortSignal | undefined;
    execute.mockImplementation(async (input) => {
      if (input.method !== "POST") return reads(detail())(input);
      signal = input.signal;
      return new Promise((_resolve, reject) =>
        input.signal?.addEventListener(
          "abort",
          () => reject(new TransportError(classifyWireFailure({ cancelled: true }))),
          { once: true },
        ),
      );
    });
    const view = await renderView();
    fireEvent.click(await screen.findByRole("button", { name: en["medical.startReview"] }));
    submit();
    await waitFor(() => expect(signal).toBeDefined());
    submit();
    expect(execute.mock.calls.filter(([input]) => input.method === "POST")).toHaveLength(1);
    view.unmount();
    expect(signal?.aborted).toBe(true);
  });

  it("gives a patient only published text and patient-scoped eligible downloads", async () => {
    execute.mockImplementation(async (input) =>
      input.path.endsWith("/outcome")
        ? response({
            medical_request: medicalRequest("M1", "R1", true),
            files: [file],
            latest_report: report("M1", true),
            report_history: [report("M1", true)],
          })
        : response([medicalRequest("M1", "R1", true)]),
    );
    await renderView("/my/reservations/R1/medical");
    await openReports();
    expect(screen.getByRole("link", { name: en["medical.download"] })).toHaveAttribute(
      "href",
      "http://127.0.0.1:8080/api/reservations/R1/medical-requests/M1/files/F1/download",
    );
    expect(screen.getByRole("link", { name: en["medical.download"] })).toHaveAttribute(
      "referrerpolicy",
      "origin",
    );
    for (const key of ["startReview", "editDraft", "publishReport", "amendReport", "newDraft"])
      expect(
        screen.queryByRole("button", { name: en[`medical.${key}` as keyof typeof en] }),
      ).not.toBeInTheDocument();
    expect(execute.mock.calls.every(([input]) => input.method === "GET")).toBe(true);
  });
});

describe("patient upload and receipt progress", () => {
  it("accepts an issued PNG policy and uses that MIME's exact limit and receipt", async () => {
    const request = {
      ...patientRequest(),
      attachment_rules: {
        ...medicalRequest().attachment_rules,
        state: "available" as const,
        field: "file" as const,
        revision: "a".repeat(64),
        issued_revision: "b".repeat(64),
        allowed_mime_types: ["image/png"],
        max_bytes_by_mime: { "image/png": 64 },
      },
    };
    execute.mockImplementation(async (input) =>
      input.method === "POST"
        ? response({ ...file, mime_type: "image/png", size_bytes: 64, available: false })
        : response([request]),
    );
    const png = new File(["x".repeat(64)], "synthetic.png", { type: "image/png" });
    await openUpload("en", png);
    expect(screen.getByLabelText(en["medical.chooseFile"])).toHaveAttribute("accept", "image/png");
    sendUpload();
    await screen.findByText(en["medical.uploadReceived"]);
    const body = execute.mock.calls.find(([input]) => input.method === "POST")?.[0].body;
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get("file")).toBe(png);
  });
  it.each(["en", "fa"] as const)(
    "shows server receipt/check counts in %s without unsafe files or active-scanning claims",
    async (locale) => {
      execute.mockResolvedValue(
        response([
          { ...patientRequest(), upload_progress: { received_count: 2, awaiting_checks_count: 1 } },
        ]),
      );
      await renderView("/my/reservations/R1/medical", locale);
      const copy = locale === "en" ? en : fa;
      await screen.findByText(
        copy["medical.receivedCount"].replace(
          "{{amount}}",
          new Intl.NumberFormat(locale).format(2),
        ),
      );
      expect(
        screen.getByText(
          copy["medical.awaitingChecksCount"].replace(
            "{{amount}}",
            new Intl.NumberFormat(locale).format(1),
          ),
        ),
      ).toBeInTheDocument();
      expect(screen.getByText(copy["medical.uploadCheckingNote"])).toBeInTheDocument();
      expect(screen.queryByText("Eligible.pdf")).not.toBeInTheDocument();
      expect(execute.mock.calls).toHaveLength(1);
    },
  );

  it.each(["en", "fa"] as const)(
    "preflights then sends only File/label and displays pending reception in %s",
    async (locale) => {
      let received = false;
      execute.mockImplementation(async (input) => {
        if (input.method === "POST") {
          received = true;
          return response({ ...file, size_bytes: 128, available: false });
        }
        return response([
          {
            ...patientRequest(),
            upload_progress: {
              received_count: Number(received),
              awaiting_checks_count: Number(received),
            },
          },
        ]);
      });
      await openUpload(locale);
      const copy = locale === "en" ? en : fa;
      fireEvent.change(screen.getByLabelText(copy["medical.fileLabel"]), {
        target: { value: " Synthetic label " },
      });
      sendUpload();
      await screen.findByText(copy["medical.uploadReceived"]);
      const calls = execute.mock.calls.map(([input]) => input);
      expect(calls.slice(0, 3).map((input) => `${input.method} ${input.path}`)).toEqual([
        "GET /api/reservations/R1/medical-requests",
        "GET /api/reservations/R1/medical-requests",
        "POST /api/reservations/R1/medical-requests/M1/files",
      ]);
      const body = calls.find((input) => input.method === "POST")?.body;
      expect(body).toBeInstanceOf(FormData);
      if (!(body instanceof FormData)) throw Error("Missing upload body");
      expect([...body.keys()]).toEqual(["file", "label"]);
      expect(body.get("label")).toBe("Synthetic label");
      expect(body.get("file")).toBeInstanceOf(File);
      expect(execute.mock.calls.filter(([input]) => input.method === "POST")).toHaveLength(1);
      expect(screen.queryByText("Eligible.pdf")).not.toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    },
  );

  it.each(["empty", "oversize", "png"])("rejects %s before preflight or upload", async (fault) => {
    execute.mockResolvedValue(response([patientRequest()]));
    await openUpload(
      "en",
      fault === "png"
        ? new File(["png"], "fake.png", { type: "image/png" })
        : syntheticPdf(fault === "empty" ? 0 : 1048577),
    );
    sendUpload();
    await screen.findByText(en["medical.invalidUpload"]);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("stops on a policy revision change and shows new exact limits before an explicit second submit", async () => {
    const original = patientRequest();
    const fresh: MedicalRequest = {
      ...original,
      attachment_rules: {
        state: "available",
        field: "file",
        revision: "c".repeat(64),
        issued_revision: "b".repeat(64),
        allowed_mime_types: ["application/pdf"],
        max_bytes_by_mime: { "application/pdf": 512 },
      },
    };
    let reads = 0;
    execute.mockImplementation(async (input) =>
      input.method === "POST"
        ? response({ ...file, size_bytes: 128, available: false })
        : response([++reads === 1 ? original : fresh]),
    );
    await openUpload();
    sendUpload();
    await screen.findByText(en["medical.uploadPolicyChanged"]);
    expect(
      screen.getByText(en["medical.uploadPdfLimit"].replace("{{bytes}}", "512")),
    ).toBeInTheDocument();
    expect(execute.mock.calls.every(([input]) => input.method === "GET")).toBe(true);
    sendUpload();
    await screen.findByText(en["medical.uploadReceived"]);
    expect(execute.mock.calls.filter(([input]) => input.method === "POST")).toHaveLength(1);
  });

  it.each(["denied", "removed", "wrong-reservation", "unavailable", "closed"])(
    "never uploads after a %s preflight",
    async (fault) => {
      let reads = 0;
      execute.mockImplementation(async () => {
        if (++reads === 1) return response([patientRequest()]);
        if (fault === "denied") throw new TransportError(classifyWireFailure({ status: 404 }));
        if (fault === "removed") return response([]);
        if (fault === "wrong-reservation")
          return response([{ ...patientRequest(), reservation_public_id: "OTHER" }]);
        return response([
          {
            ...patientRequest(),
            ...(fault === "closed"
              ? { status: "cancelled" }
              : { attachment_rules: { state: "unavailable", field: "file" } }),
          },
        ]);
      });
      await openUpload();
      sendUpload();
      await waitFor(() => expect(execute).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(screen.getAllByRole("alert").length).toBeGreaterThan(0));
      expect(execute.mock.calls.every(([input]) => input.method === "GET")).toBe(true);
      expect(screen.queryByText(en["medical.uploadReceived"])).not.toBeInTheDocument();
    },
  );

  it("keeps a definite server validation refusal editable and does not replay", async () => {
    execute.mockImplementation(async (input) => {
      if (input.method === "POST")
        throw new TransportError(
          classifyWireFailure({ status: 422, data: { errors: { file: ["upload_rejected"] } } }),
        );
      return response([patientRequest()]);
    });
    await openUpload();
    sendUpload();
    await screen.findByText("upload_rejected");
    expect(screen.getByRole("button", { name: en["medical.sendFile"] })).toBeEnabled();
    expect(screen.queryByText(en["medical.uploadUncertain"])).not.toBeInTheDocument();
    expect(execute.mock.calls.filter(([input]) => input.method === "POST")).toHaveLength(1);
  });

  it.each(["network", "size", "eligible"])(
    "blocks %s ambiguous reception across close/reopen until explicit fresh receipt read",
    async (fault) => {
      execute.mockImplementation(async (input) => {
        if (input.method === "POST") {
          if (fault === "network") throw new TransportError(classifyWireFailure({ status: 503 }));
          return response({
            ...file,
            size_bytes: fault === "size" ? 129 : 128,
            available: fault === "eligible",
          });
        }
        return response([patientRequest()]);
      });
      await openUpload();
      sendUpload();
      await screen.findByText(en["medical.uploadUncertain"]);
      expect(screen.getByRole("button", { name: en["medical.sendFile"] })).toBeDisabled();
      fireEvent.click(
        within(screen.getByRole("dialog")).getByText(en["medical.close"], { selector: "button" }),
      );
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      fireEvent.click(screen.getByRole("button", { name: en["medical.uploadFile"] }));
      expect(screen.getByRole("button", { name: en["medical.sendFile"] })).toBeDisabled();
      fireEvent.click(
        within(screen.getByRole("dialog")).getByText(en["medical.close"], { selector: "button" }),
      );
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      fireEvent.click(screen.getByRole("button", { name: en["medical.refresh"] }));
      fireEvent.click(await screen.findByRole("button", { name: en["medical.uploadFile"] }));
      expect(screen.getByRole("button", { name: en["medical.sendFile"] })).toBeEnabled();
      expect(screen.queryByText(en["medical.uploadReceived"])).not.toBeInTheDocument();
      expect(execute.mock.calls.filter(([input]) => input.method === "POST")).toHaveLength(1);
    },
  );

  it("prevents duplicate preflight submissions and sends nothing after leaving the page", async () => {
    let finish!: (value: TransportResponse<unknown>) => void;
    const waiting = new Promise<TransportResponse<unknown>>((resolve) => {
      finish = resolve;
    });
    let reads = 0;
    execute.mockImplementation(async () =>
      ++reads === 1 ? response([patientRequest()]) : waiting,
    );
    const view = await openUpload();
    sendUpload();
    sendUpload();
    expect(execute).toHaveBeenCalledTimes(2);
    // The query refresh may hide the page, but the modal must remain mounted while checking.
    expect(screen.getByRole("button", { name: en["medical.sendFile"] })).toBeDisabled();
    view.unmount();
    finish(response([{ ...patientRequest(), status: "cancelled" }]));
    await waitFor(() =>
      expect(execute.mock.calls.every(([input]) => input.method === "GET")).toBe(true),
    );
  });

  it("aborts one in-flight upload on unmount without replay or fake reception", async () => {
    let signal: AbortSignal | undefined;
    execute.mockImplementation(async (input) => {
      if (input.method !== "POST") return response([patientRequest()]);
      signal = input.signal;
      return new Promise((_resolve, reject) =>
        input.signal?.addEventListener(
          "abort",
          () => reject(new TransportError(classifyWireFailure({ cancelled: true }))),
          { once: true },
        ),
      );
    });
    const view = await renderView("/my/reservations/R1/medical");
    fireEvent.click(await screen.findByRole("button", { name: en["medical.uploadFile"] }));
    fireEvent.change(screen.getByLabelText(en["medical.chooseFile"]), {
      target: { files: [syntheticPdf()] },
    });
    sendUpload();
    await waitFor(() => expect(signal).toBeDefined());
    sendUpload();
    expect(execute.mock.calls.filter(([input]) => input.method === "POST")).toHaveLength(1);
    view.unmount();
    expect(signal?.aborted).toBe(true);
    expect(screen.queryByText(en["medical.uploadReceived"])).not.toBeInTheDocument();
  });

  it.each(["completed", "unavailable"])("hides upload actions for %s requests", async (state) => {
    execute.mockImplementation(async (input) =>
      input.path.endsWith("/outcome")
        ? response({
            medical_request: medicalRequest("M1", "R1", true),
            latest_report: report("M1", true),
            report_history: [report("M1", true)],
            files: [],
          })
        : response([
            {
              ...patientRequest(),
              ...(state === "completed"
                ? { status: "completed" }
                : { attachment_rules: { state: "unavailable", field: "file" } }),
            },
          ]),
    );
    await renderView("/my/reservations/R1/medical");
    await screen.findByRole("heading", { name: "Request M1" });
    expect(
      screen.queryByRole("button", { name: en["medical.uploadFile"] }),
    ).not.toBeInTheDocument();
  });
});

describe("role-specific medical File Manager", () => {
  it.each(["en", "fa"] as const)(
    "shows open patient requests and exact server limits in %s without querying drafts or fabricating upload status",
    async (locale) => {
      execute.mockResolvedValue(response([medicalRequest()]));
      await renderView("/my/reservations/R1/medical", locale);
      const copy = locale === "en" ? en : fa;
      await screen.findByText(copy["medical.outcomePending"]);
      expect(
        screen.getByText(new RegExp(new Intl.NumberFormat(locale).format(1048576))),
      ).toBeInTheDocument();
      expect(screen.getByRole("link", { name: copy["booking.myReservations"] })).toHaveAttribute(
        "href",
        "/my/reservations",
      );
      expect(execute.mock.calls.map(([input]) => input.path)).toEqual([
        "/api/reservations/R1/medical-requests",
      ]);
      expect(screen.queryByText("Eligible.pdf")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: copy["medical.newRequest"] }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: copy["medical.reports"] }),
      ).not.toBeInTheDocument();
    },
  );

  it("renders only eligible files and treats doctor report markup as plain text", async () => {
    execute.mockImplementation(async (input) =>
      input.path.endsWith("/M1")
        ? response({
            medical_request: medicalRequest(),
            files: [file, { ...file, public_id: "F2", label: "Unsafe.pdf", available: false }],
            reports: [report()],
          })
        : response([medicalRequest()]),
    );
    const { container } = await renderView();
    await screen.findByText("Eligible.pdf");
    expect(screen.queryByText("Unsafe.pdf")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: en["medical.reports"] }));
    expect(screen.getByText("<b>Plain report M1</b>")).toBeInTheDocument();
    expect(screen.getByText(en["medical.reportState.draft"])).toBeInTheDocument();
    expect(container.querySelector("pre b")).toBeNull();
    expect(container.querySelector(".file-manager-sidebar")).toBeInTheDocument();
    expect(container.querySelector(".file-manager-detail-content")).toBeInTheDocument();
    expect(execute.mock.calls.every(([input]) => input.method === "GET")).toBe(true);
  });

  it("shows patient published history only through the outcome endpoint", async () => {
    execute.mockImplementation(async (input) =>
      input.path.endsWith("/outcome")
        ? response({
            medical_request: medicalRequest("M1", "R1", true),
            files: [file],
            latest_report: report("M1", true),
            report_history: [report("M1", true)],
          })
        : response([medicalRequest("M1", "R1", true)]),
    );
    await renderView("/my/reservations/R1/medical");
    fireEvent.click(await screen.findByRole("button", { name: en["medical.reports"] }));
    expect(screen.getByText(en["medical.reportState.published"])).toBeInTheDocument();
    expect(screen.queryByText(en["medical.reportState.draft"])).not.toBeInTheDocument();
    expect(execute.mock.calls.map(([input]) => input.path)).toEqual([
      "/api/reservations/R1/medical-requests",
      "/api/reservations/R1/medical-requests/M1/outcome",
    ]);
  });

  it.each(["draft", "wrong-request"] as const)(
    "rejects a %s patient outcome instead of exposing its body or files",
    async (fault) => {
      const unsafe = report(fault === "wrong-request" ? "OTHER" : "M1", fault !== "draft");
      execute.mockImplementation(async (input) =>
        input.path.endsWith("/outcome")
          ? response({
              medical_request: medicalRequest("M1", "R1", true),
              files: [file],
              latest_report: unsafe,
              report_history: [unsafe],
            })
          : response([medicalRequest("M1", "R1", true)]),
      );
      await renderView("/my/reservations/R1/medical");
      await screen.findByRole("alert");
      expect(screen.queryByText("Eligible.pdf")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: en["medical.reports"] })).not.toBeInTheDocument();
    },
  );

  it("clears the old request/report while a different request is loading", async () => {
    let resolveSecond!: (value: TransportResponse<unknown>) => void;
    const second = new Promise<TransportResponse<unknown>>((resolve) => {
      resolveSecond = resolve;
    });
    execute.mockImplementation(async (input) =>
      input.path.endsWith("/M2")
        ? second
        : input.path.endsWith("/M1")
          ? response({ medical_request: medicalRequest(), files: [file], reports: [report()] })
          : response([medicalRequest(), medicalRequest("M2")]),
    );
    await renderView();
    fireEvent.click(await screen.findByRole("button", { name: en["medical.reports"] }));
    expect(screen.getByText("<b>Plain report M1</b>")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Request M2" }));
    expect(screen.queryByText("<b>Plain report M1</b>")).not.toBeInTheDocument();
    expect(screen.queryByText("Eligible.pdf")).not.toBeInTheDocument();
    resolveSecond(
      response({
        medical_request: medicalRequest("M2"),
        files: [{ ...file, label: "Second.pdf" }],
        reports: [],
      }),
    );
    await screen.findByText("Second.pdf");
  });

  it("remounts selection/overlays and hides old data across reservation URLs", async () => {
    let resolveNext!: (value: TransportResponse<unknown>) => void;
    const next = new Promise<TransportResponse<unknown>>((resolve) => {
      resolveNext = resolve;
    });
    execute.mockImplementation(async (input) =>
      input.path.includes("/R2/")
        ? next
        : input.path.endsWith("/M1")
          ? response({ medical_request: medicalRequest(), files: [file], reports: [report()] })
          : response([medicalRequest()]),
    );
    await renderView();
    fireEvent.click(await screen.findByRole("button", { name: en["medical.reports"] }));
    fireEvent.click(screen.getByRole("link", { name: "Next reservation" }));
    expect(screen.queryByText("Eligible.pdf")).not.toBeInTheDocument();
    expect(screen.queryByText("<b>Plain report M1</b>")).not.toBeInTheDocument();
    resolveNext(response([]));
    await screen.findByText(en["medical.noRequests"]);
  });

  it("does not display another reservation's resources or send a detail request", async () => {
    execute.mockResolvedValue(response([medicalRequest("M1", "OTHER")]));
    await renderView();
    await screen.findByRole("alert");
    expect(screen.queryByText("Synthetic instructions")).not.toBeInTheDocument();
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("displays unavailable policy without guessing limits", async () => {
    execute.mockResolvedValue(
      response([
        { ...medicalRequest(), attachment_rules: { state: "unavailable", field: "file" } },
      ]),
    );
    await renderView("/my/reservations/R1/medical");
    await screen.findByText(en["medical.policyUnavailable"]);
    expect(screen.queryByText(/application\/pdf/)).not.toBeInTheDocument();
  });

  it("hides retained detail after a failed refresh and shows access denial", async () => {
    let denied = false;
    execute.mockImplementation(async (input) => {
      if (denied) throw new TransportError(classifyWireFailure({ status: 404 }));
      return input.path.endsWith("/M1")
        ? response({ medical_request: medicalRequest(), files: [file], reports: [report()] })
        : response([medicalRequest()]);
    });
    await renderView();
    await screen.findByText("Eligible.pdf");
    denied = true;
    fireEvent.click(screen.getByRole("button", { name: en["medical.refresh"] }));
    await screen.findByRole("alert");
    expect(screen.queryByText("Eligible.pdf")).not.toBeInTheDocument();
    expect(screen.queryByText("Synthetic instructions")).not.toBeInTheDocument();
  });

  it.each(["my", "doctor"])(
    "enters the %s medical route from its reservation table",
    async (role) => {
      execute.mockResolvedValue(
        response({
          data: [
            {
              id: 1,
              public_id: "R1",
              status: "confirmed",
              starts_at: "2026-10-11T04:30:00Z",
              booked_amount: 100,
              booked_currency: "IRR",
              payment: { status: "paid" },
              checkup: { title: "Synthetic checkup" },
            },
          ],
          current_page: 1,
          last_page: 1,
          per_page: 20,
          total: 1,
        }),
      );
      await renderView(`/${role}/reservations`);
      const link = await screen.findByRole("link", { name: en["medical.title"] });
      expect(link).toHaveAttribute("href", `/${role}/reservations/R1/medical`);
    },
  );
});

describe("ordinary assigned-doctor request controls", () => {
  const submitDialog = async () => {
    await waitFor(() =>
      expect(document.querySelector("#medical-category-document")).not.toBeNull(),
    );
    const form = screen.getByRole("dialog").querySelector("form");
    if (!form) throw new Error("Request form missing");
    fireEvent.submit(form);
  };
  it("sends multiple selected categories without a doctor-owned size limit", async () => {
    const issued = medicalRequest("NEW");
    execute.mockImplementation(async (input) =>
      input.method === "POST"
        ? response(issued)
        : input.path.endsWith("/NEW")
          ? response({ medical_request: issued, files: [], reports: [] })
          : response([]),
    );
    await renderView();
    fireEvent.click(await screen.findByRole("button", { name: en["medical.newRequest"] }));
    fireEvent.click(await screen.findByLabelText(new RegExp(en["medical.category.media"])));
    fireEvent.change(screen.getByLabelText(en["medical.requestTitle"]), {
      target: { value: "Synthetic multi-type request" },
    });
    await submitDialog();
    await screen.findByText(en["medical.requestCreated"]);
    expect(execute.mock.calls.find(([input]) => input.method === "POST")?.[0].body).toEqual({
      request_type: "attachments",
      title: "Synthetic multi-type request",
      instructions: null,
      attachment_categories: ["document", "media"],
    });
  });
  it.each(["en", "fa"] as const)(
    "issues a PDF request from the empty view in %s after a fresh access check",
    async (locale) => {
      const copy = locale === "en" ? en : fa;
      const issued = {
        ...medicalRequest("NEW"),
        title: "Synthetic request",
        attachment_rules: {
          ...medicalRequest().attachment_rules,
          state: "available" as const,
          field: "file" as const,
          revision: "c".repeat(64),
          issued_revision: "d".repeat(64),
          allowed_mime_types: ["application/pdf"],
          max_bytes_by_mime: { "application/pdf": 512 },
        },
      };
      let saved = false;
      execute.mockImplementation(async (input) => {
        if (input.method === "POST") {
          saved = true;
          return response(issued);
        }
        if (input.path.endsWith("/NEW"))
          return response({ medical_request: issued, files: [], reports: [] });
        return response(saved ? [issued] : []);
      });
      await renderView("/doctor/reservations/R1/medical", locale);
      fireEvent.click(await screen.findByRole("button", { name: copy["medical.newRequest"] }));
      fireEvent.change(screen.getByLabelText(copy["medical.requestTitle"]), {
        target: { value: " Synthetic request " },
      });
      fireEvent.change(screen.getByLabelText(copy["medical.instructions"]), {
        target: { value: " Synthetic instructions " },
      });
      await submitDialog();
      await screen.findByText(copy["medical.requestCreated"]);
      expect(
        execute.mock.calls.slice(0, 3).map(([input]) => `${input.method} ${input.path}`),
      ).toEqual([
        "GET /api/doctor/reservations/R1/medical-requests",
        "GET /api/doctor/reservations/R1/medical-requests",
        "POST /api/doctor/reservations/R1/medical-requests",
      ]);
      expect(execute.mock.calls.find(([input]) => input.method === "POST")?.[0].body).toEqual({
        request_type: "document",
        title: "Synthetic request",
        instructions: "Synthetic instructions",
        attachment_categories: ["document"],
      });
      expect(
        await screen.findByText(new RegExp(new Intl.NumberFormat(locale).format(512))),
      ).toBeInTheDocument();
      expect(execute.mock.calls.filter(([input]) => input.method === "POST")).toHaveLength(1);
    },
  );

  it("requires a category, hides size editing and gates unsupported validators", async () => {
    execute.mockResolvedValue(response([]));
    await renderView();
    fireEvent.click(await screen.findByRole("button", { name: en["medical.newRequest"] }));
    const documentChoice = await screen.findByLabelText(
      new RegExp(en["medical.category.document"]),
    );
    expect(document.querySelector("#medical-request-limit")).toBeNull();
    expect(document.querySelector("#medical-category-archive")).toBeDisabled();
    expect(document.querySelector("#medical-category-multimedia")).toBeDisabled();
    fireEvent.change(screen.getByLabelText(en["medical.requestTitle"]), {
      target: { value: "Synthetic request" },
    });
    fireEvent.click(documentChoice);
    await submitDialog();
    await screen.findByText(en["medical.invalidRequest"]);
    expect(execute.mock.calls.filter(([input]) => input.method === "POST")).toHaveLength(0);
  });

  it.each(["denied", "wrong-reservation"])(
    "refuses to POST after a %s fresh list",
    async (fault) => {
      let calls = 0;
      execute.mockImplementation(async () => {
        if (++calls === 1) return response([]);
        if (fault === "denied") throw new TransportError(classifyWireFailure({ status: 404 }));
        return response([medicalRequest("M1", "OTHER")]);
      });
      await renderView();
      fireEvent.click(await screen.findByRole("button", { name: en["medical.newRequest"] }));
      fireEvent.change(screen.getByLabelText(en["medical.requestTitle"]), {
        target: { value: "Synthetic request" },
      });
      await submitDialog();
      await waitFor(() => expect(execute).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(screen.getAllByRole("alert").length).toBeGreaterThan(0));
      expect(execute.mock.calls.every(([input]) => input.method === "GET")).toBe(true);
      expect(screen.queryByText(en["medical.requestCreated"])).not.toBeInTheDocument();
    },
  );

  it("keeps a rejected current-policy response editable without widening the rules or replaying", async () => {
    execute.mockImplementation(async (input) => {
      if (input.method === "POST")
        throw new TransportError(
          classifyWireFailure({
            status: 422,
            data: { errors: { "attachment_rules.max_bytes": ["upload_rejected"] } },
          }),
        );
      return response([]);
    });
    await renderView();
    fireEvent.click(await screen.findByRole("button", { name: en["medical.newRequest"] }));
    fireEvent.change(screen.getByLabelText(en["medical.requestTitle"]), {
      target: { value: "Synthetic request" },
    });
    await submitDialog();
    await screen.findByText("upload_rejected");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: en["medical.issueRequest"] })).toBeEnabled(),
    );
    expect(screen.queryByText(en["medical.requestUncertain"])).not.toBeInTheDocument();
    expect(execute.mock.calls.filter(([input]) => input.method === "POST")).toHaveLength(1);
    expect(screen.queryByText(en["medical.requestCreated"])).not.toBeInTheDocument();
  });

  it("blocks uncertain delivery across dialog reopening until a successful explicit list refresh", async () => {
    execute.mockImplementation(async (input) => {
      if (input.method === "POST") throw new TransportError(classifyWireFailure({ status: 503 }));
      return response([]);
    });
    await renderView();
    fireEvent.click(await screen.findByRole("button", { name: en["medical.newRequest"] }));
    fireEvent.change(screen.getByLabelText(en["medical.requestTitle"]), {
      target: { value: "Synthetic request" },
    });
    await submitDialog();
    await screen.findByText(en["medical.requestUncertain"]);
    expect(screen.getByRole("button", { name: en["medical.issueRequest"] })).toBeDisabled();
    fireEvent.click(
      within(screen.getByRole("dialog")).getByText(en["medical.close"], { selector: "button" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: en["medical.newRequest"] }));
    expect(screen.getByRole("button", { name: en["medical.issueRequest"] })).toBeDisabled();
    fireEvent.click(
      within(screen.getByRole("dialog")).getByText(en["medical.close"], { selector: "button" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: en["medical.refresh"] }));
    fireEvent.click(await screen.findByRole("button", { name: en["medical.newRequest"] }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: en["medical.issueRequest"] })).toBeEnabled(),
    );
    expect(execute.mock.calls.filter(([input]) => input.method === "POST")).toHaveLength(1);
  });

  it("prevents duplicate submits during the fresh read and sends nothing after leaving that reservation", async () => {
    let finish!: (value: TransportResponse<unknown>) => void;
    const check = new Promise<TransportResponse<unknown>>((resolve) => {
      finish = resolve;
    });
    let reads = 0;
    execute.mockImplementation(async () => (++reads === 1 ? response([]) : check));
    const view = await renderView();
    fireEvent.click(await screen.findByRole("button", { name: en["medical.newRequest"] }));
    fireEvent.change(screen.getByLabelText(en["medical.requestTitle"]), {
      target: { value: "Synthetic request" },
    });
    await submitDialog();
    await submitDialog();
    expect(screen.getByRole("button", { name: en["medical.issueRequest"] })).toBeDisabled();
    expect(execute).toHaveBeenCalledTimes(2);
    view.unmount();
    finish(response([]));
    await waitFor(() =>
      expect(execute.mock.calls.every(([input]) => input.method === "GET")).toBe(true),
    );
  });

  it("aborts an in-flight save when the page unmounts without replaying or fabricating a receipt", async () => {
    let writeSignal: AbortSignal | undefined;
    execute.mockImplementation(async (input) => {
      if (input.method !== "POST") return response([]);
      writeSignal = input.signal;
      return new Promise((_resolve, reject) => {
        input.signal?.addEventListener(
          "abort",
          () => reject(new TransportError(classifyWireFailure({ cancelled: true }))),
          { once: true },
        );
      });
    });
    const view = await renderView();
    fireEvent.click(await screen.findByRole("button", { name: en["medical.newRequest"] }));
    fireEvent.change(screen.getByLabelText(en["medical.requestTitle"]), {
      target: { value: "Synthetic request" },
    });
    await submitDialog();
    await waitFor(() => expect(writeSignal).toBeDefined());
    await submitDialog();
    expect(execute.mock.calls.filter(([input]) => input.method === "POST")).toHaveLength(1);
    view.unmount();
    expect(writeSignal?.aborted).toBe(true);
    expect(screen.queryByText(en["medical.requestCreated"])).not.toBeInTheDocument();
  });

  it("blocks an acknowledgement from a different reservation without selecting or showing it", async () => {
    execute.mockImplementation(async (input) =>
      input.method === "POST" ? response(medicalRequest("FORGED", "OTHER")) : response([]),
    );
    await renderView();
    fireEvent.click(await screen.findByRole("button", { name: en["medical.newRequest"] }));
    fireEvent.change(screen.getByLabelText(en["medical.requestTitle"]), {
      target: { value: "Synthetic request" },
    });
    await submitDialog();
    await screen.findByText(en["medical.requestUncertain"]);
    expect(screen.getByRole("button", { name: en["medical.issueRequest"] })).toBeDisabled();
    expect(screen.queryByText("Request FORGED")).not.toBeInTheDocument();
    expect(screen.queryByText(en["medical.requestCreated"])).not.toBeInTheDocument();
  });
});
