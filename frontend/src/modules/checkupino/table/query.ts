import type { ServerFilterValue, ServerTableEndpointAdapter, ServerTableQuery } from "./contracts";

export const DEFAULT_SERVER_TABLE_PAGE_SIZE = 20;
export const MAX_SERVER_TABLE_PAGE_SIZE = 100;

const positiveInteger = (value: string | null, fallback: number, maximum?: number) => {
  if (!value || !/^\d+$/.test(value)) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return fallback;
  return maximum ? Math.min(parsed, maximum) : parsed;
};

const endpointPageLimits = <TData>(adapter: ServerTableEndpointAdapter<TData>) => {
  const maximum = Math.max(1, adapter.maxPerPage ?? MAX_SERVER_TABLE_PAGE_SIZE);
  const fallback = Math.min(
    Math.max(1, adapter.defaultPerPage ?? DEFAULT_SERVER_TABLE_PAGE_SIZE),
    maximum,
  );
  return { fallback, maximum };
};

const sortedFilterDefinitions = <TData>(adapter: ServerTableEndpointAdapter<TData>) =>
  Object.entries(adapter.filters ?? {}).sort(
    ([leftKey, left], [rightKey, right]) =>
      left.parameter.localeCompare(right.parameter) || leftKey.localeCompare(rightKey),
  );

export const createDefaultServerTableQuery = <TData>(
  adapter: ServerTableEndpointAdapter<TData>,
): ServerTableQuery => ({
  filters: {},
  page: 1,
  perPage: endpointPageLimits(adapter).fallback,
  search: "",
  sort: null,
});

export const parseServerTableQuery = <TData>(
  parameters: URLSearchParams,
  adapter: ServerTableEndpointAdapter<TData>,
): ServerTableQuery => {
  const { fallback, maximum } = endpointPageLimits(adapter);
  const backendSort = parameters.get("sort_by");
  const columnId = Object.entries(adapter.sortableColumns).find(
    ([, parameter]) => parameter === backendSort,
  )?.[0];
  const direction = parameters.get("sort_dir");
  const filters: Record<string, ServerFilterValue> = {};

  for (const [filterId, definition] of sortedFilterDefinitions(adapter)) {
    const raw = parameters.get(definition.parameter);
    if (raw === null) continue;
    const value = definition.parse ? definition.parse(raw) : raw;
    if (value !== undefined) filters[filterId] = value;
  }

  return {
    filters,
    page: positiveInteger(parameters.get("page"), 1),
    perPage: positiveInteger(parameters.get("per_page"), fallback, maximum),
    search: parameters.get("q")?.trim() ?? "",
    sort:
      columnId && (direction === "asc" || direction === "desc") ? { columnId, direction } : null,
  };
};

export const serializeServerTableQuery = <TData>(
  query: ServerTableQuery,
  adapter: ServerTableEndpointAdapter<TData>,
) => {
  const { fallback, maximum } = endpointPageLimits(adapter);
  const parameters = new URLSearchParams();
  parameters.set("page", String(Math.max(1, Math.trunc(query.page))));
  parameters.set(
    "per_page",
    String(Math.min(Math.max(1, Math.trunc(query.perPage || fallback)), maximum)),
  );

  const search = query.search.trim();
  if (search) parameters.set("q", search);

  if (query.sort) {
    const backendSort = adapter.sortableColumns[query.sort.columnId];
    if (backendSort) {
      parameters.set("sort_by", backendSort);
      parameters.set("sort_dir", query.sort.direction);
    }
  }

  for (const [filterId, definition] of sortedFilterDefinitions(adapter)) {
    const value = query.filters[filterId];
    if (value === undefined) continue;
    const serialized = definition.serialize ? definition.serialize(value) : String(value);
    if (serialized !== undefined && serialized !== "") {
      parameters.set(definition.parameter, serialized);
    }
  }

  return parameters;
};

export const serverTableBackendParameters = <TData>(
  query: ServerTableQuery,
  adapter: ServerTableEndpointAdapter<TData>,
) => Object.fromEntries(serializeServerTableQuery(query, adapter));
