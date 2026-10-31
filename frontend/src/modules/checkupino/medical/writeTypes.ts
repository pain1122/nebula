import type { MedicalRequestScope } from "./types";

export interface MedicalRequestDraft {
  readonly requestType: string;
  readonly title: string;
  readonly instructions?: string | null;
  readonly dueAt?: string | null;
  readonly attachmentCategories?: readonly string[];
  readonly attachmentRules?: {
    readonly maxBytes?: number;
    readonly allowedMimeTypes?: readonly string[];
  };
}

export interface MedicalUpload extends MedicalRequestScope {
  readonly file: File;
  readonly label?: string;
}

export interface MedicalReportScope extends MedicalRequestScope {
  readonly reportId: string;
}

export interface MedicalReportDraft {
  readonly body: string;
  readonly supersedesReportId?: string | null;
}
