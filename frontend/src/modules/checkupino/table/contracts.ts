import type { ListResult } from "../../../core";

export type ServerRowIdentifier = number | string;
export type ServerFilterValue = boolean | number | string;
export type ServerSortDirection = "asc" | "desc";

export interface ServerTableSort {
  readonly columnId: string;
  readonly direction: ServerSortDirection;
}

export interface ServerTableQuery {
  readonly filters: Readonly<Record<string, ServerFilterValue>>;
  readonly page: number;
  readonly perPage: number;
  readonly search: string;
  readonly sort: ServerTableSort | null;
}

export interface ServerTableFilterDefinition {
  readonly parameter: string;
  readonly parse?: (value: string) => ServerFilterValue | undefined;
  readonly serialize?: (value: ServerFilterValue) => string | undefined;
}

export interface ServerTableEndpointAdapter<TData> {
  readonly defaultPerPage?: number;
  readonly filters?: Readonly<Record<string, ServerTableFilterDefinition>>;
  readonly getRouteIdentifier: (row: TData) => ServerRowIdentifier;
  readonly getRowIdentifier: (row: TData) => ServerRowIdentifier;
  readonly maxPerPage?: number;
  readonly pinnedColumns?: Readonly<{
    readonly end?: readonly string[];
    readonly start?: readonly string[];
  }>;
  readonly sortableColumns: Readonly<Record<string, string>>;
}

export interface ServerTableData<TData> {
  readonly result: ListResult<TData>;
}

export const stableTableRowId = (identifier: ServerRowIdentifier) =>
  `${typeof identifier}:${String(identifier)}`;

export const routeIdentifierForRow = <TData>(
  row: TData,
  adapter: ServerTableEndpointAdapter<TData>,
) => adapter.getRouteIdentifier(row);
