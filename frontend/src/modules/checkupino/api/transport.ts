import axios from "axios";
import type { AxiosError, AxiosInstance } from "axios";

import { joinPath, runtimeConfig } from "../../../core";
import type { TransportAdapter, TransportRequest, TransportResponse } from "../../../core";
import { TransportError, classifyWireFailure } from "./wire";

const transportErrorListeners = new Set<(error: TransportError) => void>();

export const subscribeTransportErrors = (listener: (error: TransportError) => void) => {
  transportErrorListeners.add(listener);
  return () => transportErrorListeners.delete(listener);
};

const publishTransportError = (error: TransportError) => {
  for (const listener of transportErrorListeners) listener(error);
  return error;
};

export interface HttpExecutionRequest {
  readonly body?: unknown;
  readonly idempotencyKey?: string;
  readonly method: TransportRequest["method"];
  readonly path: string;
  readonly query: string;
  readonly signal?: AbortSignal;
}

export interface HttpExecutionResponse {
  readonly data: unknown;
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly status: number;
}

export interface HttpExecutor {
  execute(request: HttpExecutionRequest): Promise<HttpExecutionResponse>;
}

const normalizeHeaderValue = (value: unknown) => {
  if (typeof value === "string") return value;
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    const values = value.filter(
      (item): item is boolean | number | string =>
        typeof item === "boolean" || typeof item === "number" || typeof item === "string",
    );
    return values.length > 0 ? values.join(", ") : undefined;
  }
  return undefined;
};

const normalizeHeaders = (headers: Readonly<Record<string, unknown>>) =>
  Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [
      name.toLowerCase(),
      normalizeHeaderValue(value),
    ]),
  );

const axiosFailureSnapshot = (error: AxiosError<unknown>) => ({
  cancelled: error.code === "ERR_CANCELED",
  data: error.response?.data,
  headers: error.response ? normalizeHeaders(error.response.headers) : undefined,
  message: error.message,
  status: error.response?.status,
});

const createAxiosExecutor = (client: AxiosInstance): HttpExecutor => ({
  async execute(request) {
    try {
      const response = await client.request({
        data: request.body,
        // Safe reads need cookies, but not the custom headers that add a CORS preflight.
        headers:
          request.method === "GET"
            ? { "X-Requested-With": false }
            : request.idempotencyKey
              ? { "Idempotency-Key": request.idempotencyKey }
              : undefined,
        method: request.method,
        params: request.query ? new URLSearchParams(request.query) : undefined,
        signal: request.signal,
        url: request.path,
        withXSRFToken: request.method !== "GET",
      });

      return {
        data: response.data,
        headers: normalizeHeaders(response.headers),
        status: response.status,
      };
    } catch (error: unknown) {
      if (axios.isAxiosError<unknown>(error)) {
        throw publishTransportError(
          new TransportError(classifyWireFailure(axiosFailureSnapshot(error))),
        );
      }
      throw publishTransportError(
        new TransportError(
          classifyWireFailure({ message: error instanceof Error ? error.message : undefined }),
        ),
      );
    }
  },
});

export const serializeQuery = (query: TransportRequest["query"]) => {
  const parameters = new URLSearchParams();

  for (const [name, value] of Object.entries(query || {}).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    if (value !== undefined) parameters.append(name, value === null ? "" : String(value));
  }

  return parameters.toString();
};

export const createTransport = (executor: HttpExecutor): TransportAdapter => ({
  async request<TData>(request: TransportRequest): Promise<TransportResponse<TData>> {
    if (/^[a-z][a-z\d+.-]*:/i.test(request.path)) {
      throw new TypeError("Transport paths must be relative to the configured backend.");
    }

    const response = await executor.execute({
      body: request.body,
      ...(request.idempotencyKey ? { idempotencyKey: request.idempotencyKey } : {}),
      method: request.method,
      path: joinPath("/", request.path),
      query: serializeQuery(request.query),
      signal: request.signal,
    });

    return {
      data: (response.status === 204 ? undefined : response.data) as TData,
      headers: response.headers,
      status: response.status,
    };
  },
});

const credentialedClient = axios.create({
  baseURL: runtimeConfig.backendOrigin,
  headers: {
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
  },
  withCredentials: true,
  withXSRFToken: true,
});

export const checkupinoTransport = createTransport(createAxiosExecutor(credentialedClient));

export const patientArticleImageUrl = (path: string): string => {
  if (
    !/^\/api\/my\/articles\/[0-7][0-9a-hjkmnp-tv-z]{25}\/media\/[0-7][0-9a-hjkmnp-tv-z]{25}\?version_id=[0-7][0-9a-hjkmnp-tv-z]{25}&language=(?:en|fa)$/.test(
      path,
    )
  )
    throw new TypeError("Patient image path rejected.");
  return runtimeConfig.backendOrigin + path;
};

export const articleMediaImagePath = (id: string): string => {
  if (!/^[0-7][0-9a-hjkmnp-tv-z]{25}$/.test(id))
    throw new TypeError("Editorial images require a public identifier.");
  return `/api/admin/article-media/${id}/content`;
};
export const articleMediaImageUrl = (id: string) =>
  runtimeConfig.backendOrigin + articleMediaImagePath(id);

export const recommendationImageUrl = (
  ruleId: string,
  ruleVersion: number,
  articleId: string,
  assetId: string,
  language: "en" | "fa",
  doctor: boolean,
): string => {
  for (const id of [ruleId, articleId, assetId]) {
    if (!/^[0-7][0-9a-hjkmnp-tv-z]{25}$/.test(id))
      throw new Error("Invalid recommendation image identity.");
  }
  if (!Number.isSafeInteger(ruleVersion) || ruleVersion < 1 || !["en", "fa"].includes(language))
    throw new Error("Invalid recommendation image binding.");
  const query = new URLSearchParams({
    article_id: articleId,
    rule_version: String(ruleVersion),
    language,
  });
  return `${runtimeConfig.backendOrigin}/api/${doctor ? "doctor" : "admin"}/recommendation-rules/${ruleId}/media/${assetId}?${query}`;
};
export const articleMediaImageId = (value: string): string | null => {
  const prefix = "/api/admin/article-media/";
  const path = value.startsWith(runtimeConfig.backendOrigin + prefix)
    ? value.slice(runtimeConfig.backendOrigin.length)
    : value;
  return (
    /^\/api\/admin\/article-media\/([0-7][0-9a-hjkmnp-tv-z]{25})\/content$/.exec(path)?.[1] ?? null
  );
};

// Downloads keep the same configured origin and cookie authority as API reads.
// Callers provide public identifiers only; no signed/private-storage URL is exposed.
export const medicalFileDownloadUrl = ({
  reservationId,
  requestId,
  fileId,
  doctor = false,
}: {
  readonly reservationId: string;
  readonly requestId: string;
  readonly fileId: string;
  readonly doctor?: boolean;
}): string => {
  if ([reservationId, requestId, fileId].some((id) => !id || id === "." || id === "..")) {
    throw new TypeError("Medical downloads require public identifiers.");
  }
  return `${runtimeConfig.backendOrigin}/api/${doctor ? "doctor/" : ""}reservations/${encodeURIComponent(reservationId)}/medical-requests/${encodeURIComponent(requestId)}/files/${encodeURIComponent(fileId)}/download`;
};

export const adminMedicalFileDownloadUrl = (requestId: string, fileId: string): string => {
  if (![requestId, fileId].every((id) => /^[0-9a-hjkmnp-tv-z]{26}$/i.test(id))) {
    throw new TypeError("Administrative downloads require public identifiers.");
  }
  return `${runtimeConfig.backendOrigin}/api/admin/medical-requests/${encodeURIComponent(requestId)}/files/${encodeURIComponent(fileId)}/download`;
};
