// These are safe API resources. Storage, scan internals and internal notes stay server-side.
export type MedicalAttachmentRules =
  | { readonly state: "unavailable"; readonly field: "file" }
  | {
      readonly state: "available";
      readonly field: "file";
      readonly revision: string;
      readonly issued_revision: string;
      readonly allowed_mime_types: readonly string[];
      readonly max_bytes_by_mime: Readonly<Record<string, number>>;
    };

export interface MedicalRequest {
  readonly public_id: string;
  readonly reservation_public_id: string;
  readonly request_type: string;
  readonly title: string;
  readonly instructions: string | null;
  readonly status: "open" | "in_review" | "completed" | "cancelled";
  readonly attachment_rules: MedicalAttachmentRules;
  // Optional for compatibility with earlier safe read-only resources.
  readonly upload_progress?: {
    readonly received_count: number;
    readonly awaiting_checks_count: number;
  };
  readonly due_at: string | null;
  readonly reviewed_at: string | null;
  readonly closed_at: string | null;
  readonly created_at: string | null;
}

export interface MedicalFile {
  readonly public_id: string;
  readonly label: string | null;
  readonly mime_type: string;
  readonly size_bytes: number;
  readonly available: boolean;
  readonly created_at: string | null;
}

export interface MedicalReport {
  readonly public_id: string;
  readonly medical_request_public_id: string;
  readonly status: "draft" | "published";
  readonly body: string;
  readonly body_format: "plain_text";
  readonly author_name: string | null;
  readonly published_at: string | null;
  readonly supersedes_report_public_id: string | null;
  readonly created_at: string | null;
}

export interface DoctorMedicalDetail {
  readonly medical_request: MedicalRequest;
  readonly files: readonly MedicalFile[];
  readonly reports: readonly MedicalReport[];
}

export interface PatientMedicalOutcome {
  readonly medical_request: MedicalRequest;
  readonly files: readonly MedicalFile[];
  readonly latest_report: MedicalReport;
  readonly report_history: readonly MedicalReport[];
}

export interface MedicalRequestScope {
  readonly reservationId: string;
  readonly requestId: string;
}
