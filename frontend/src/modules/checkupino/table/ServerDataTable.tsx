import {
  columnPinningFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createColumnHelper,
  flexRender,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type Cell,
  type Column,
  type ColumnDef,
  type Header,
  type PaginationState,
  type RowData,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table";
import type { CSSProperties, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { ListResult } from "../../../core";
import { EmptyState, ErrorState, LoadingState } from "../feedback";
import { formatProductNumber, type ProductLocale } from "../preferences/localization";
import type {
  ServerFilterValue,
  ServerRowIdentifier,
  ServerTableEndpointAdapter,
  ServerTableQuery,
} from "./contracts";
import { stableTableRowId } from "./contracts";

export const serverTableFeatures = tableFeatures({
  columnPinningFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
});

export type ServerTableFeatures = typeof serverTableFeatures;
export type ServerTableColumnDef<TData extends RowData, TValue = unknown> = ColumnDef<
  ServerTableFeatures,
  TData,
  TValue
>;

export const createServerTableColumnHelper = <TData extends RowData>() =>
  createColumnHelper<ServerTableFeatures, TData>();

interface TableCopy {
  readonly empty: string;
  readonly firstPage: string;
  readonly lastPage: string;
  readonly nextPage: string;
  readonly page: string;
  readonly pageSize: string;
  readonly previousPage: string;
  readonly search: string;
  readonly selectRow: string;
  readonly selectedCount: string;
  readonly sortAscending: string;
  readonly sortDescending: string;
}

const tableCopy: Readonly<Record<ProductLocale, TableCopy>> = {
  en: {
    empty: "No rows are available.",
    firstPage: "First page",
    lastPage: "Last page",
    nextPage: "Next page",
    page: "Page",
    pageSize: "Rows per page",
    previousPage: "Previous page",
    search: "Search",
    selectRow: "Select row",
    selectedCount: "Selected rows",
    sortAscending: "Sort ascending",
    sortDescending: "Sort descending",
  },
  fa: {
    empty: "ردیفی برای نمایش وجود ندارد.",
    firstPage: "صفحه نخست",
    lastPage: "صفحه آخر",
    nextPage: "صفحه بعد",
    page: "صفحه",
    pageSize: "تعداد ردیف در صفحه",
    previousPage: "صفحه قبل",
    search: "جستجو",
    selectRow: "انتخاب ردیف",
    selectedCount: "ردیف‌های انتخاب‌شده",
    sortAscending: "مرتب‌سازی صعودی",
    sortDescending: "مرتب‌سازی نزولی",
  },
};

const EMPTY_ROWS: readonly never[] = [];

export interface ServerTableFilterContext {
  readonly filters: Readonly<Record<string, ServerFilterValue>>;
  readonly setFilter: (filterId: string, value: ServerFilterValue | undefined) => void;
}

export interface ServerTableSelection {
  readonly onChange: (identifiers: readonly ServerRowIdentifier[]) => void;
  readonly selected: readonly ServerRowIdentifier[];
}

export interface ServerDataTableProps<TData extends RowData> {
  readonly adapter: ServerTableEndpointAdapter<TData>;
  readonly columns: readonly ServerTableColumnDef<TData>[];
  readonly debounceMilliseconds?: number;
  readonly error?: unknown;
  readonly filterControls?: (context: ServerTableFilterContext) => ReactNode;
  readonly loading?: boolean;
  readonly locale?: ProductLocale;
  readonly onQueryChange: (query: ServerTableQuery) => void;
  readonly onRetry?: () => void;
  readonly pageSizeOptions?: readonly number[];
  readonly query: ServerTableQuery;
  readonly result?: ListResult<TData>;
  readonly selection?: ServerTableSelection;
  readonly searchable?: boolean;
}

const resolveUpdate = <TValue,>(
  update: TValue | ((previous: TValue) => TValue),
  previous: TValue,
) => (typeof update === "function" ? (update as (value: TValue) => TValue)(previous) : update);

const selectedKeySet = (selected: readonly ServerRowIdentifier[]) =>
  new Set(selected.map(stableTableRowId));

const pinnedStyle = <TData extends RowData>(
  column: Column<ServerTableFeatures, TData, unknown>,
): CSSProperties | undefined => {
  const position = column.getIsPinned();
  if (!position) return undefined;

  return {
    background: "var(--vz-card-bg, var(--bs-body-bg))",
    insetInlineEnd: position === "end" ? `${column.getAfter("end")}px` : undefined,
    insetInlineStart: position === "start" ? `${column.getStart("start")}px` : undefined,
    position: "sticky",
    width: column.getSize(),
    zIndex: 1,
  };
};

const ariaSort = <TData extends RowData>(column: Column<ServerTableFeatures, TData, unknown>) => {
  const sorting = column.getIsSorted();
  if (sorting === "asc") return "ascending" as const;
  if (sorting === "desc") return "descending" as const;
  return "none" as const;
};

export const ServerDataTable = <TData extends RowData>({
  adapter,
  columns,
  debounceMilliseconds = 350,
  error,
  filterControls,
  loading = false,
  locale = "fa",
  onQueryChange,
  onRetry,
  pageSizeOptions = [10, 20, 50, 100],
  query,
  result,
  selection,
  searchable = true,
}: ServerDataTableProps<TData>) => {
  const copy = tableCopy[locale];
  const rows: readonly TData[] = result?.items ?? EMPTY_ROWS;
  const [searchDraft, setSearchDraft] = useState({
    committed: query.search,
    value: query.search,
  });
  const search = searchDraft.committed === query.search ? searchDraft.value : query.search;
  const visibleIdentifiers = useMemo(
    () => rows.map((row) => adapter.getRowIdentifier(row)),
    [adapter, rows],
  );
  const visibleIdentifierByKey = useMemo(
    () =>
      new Map(visibleIdentifiers.map((identifier) => [stableTableRowId(identifier), identifier])),
    [visibleIdentifiers],
  );
  const selectedKeys = selectedKeySet(selection?.selected ?? []);
  const rowSelection = Object.fromEntries(
    [...visibleIdentifierByKey.keys()]
      .filter((identifier) => selectedKeys.has(identifier))
      .map((identifier) => [identifier, true]),
  ) as RowSelectionState;
  const pagination: PaginationState = {
    pageIndex: Math.max(0, query.page - 1),
    pageSize: query.perPage,
  };
  const sorting: SortingState = query.sort
    ? [{ desc: query.sort.direction === "desc", id: query.sort.columnId }]
    : [];

  const clearSelection = useCallback(() => {
    if (selection && selection.selected.length > 0) selection.onChange([]);
  }, [selection]);

  const commitQuery = useCallback(
    (next: ServerTableQuery) => {
      clearSelection();
      onQueryChange(next);
    },
    [clearSelection, onQueryChange],
  );

  useEffect(() => {
    if (search === query.search) return;
    const timer = window.setTimeout(
      () => {
        commitQuery({ ...query, page: 1, search: search.trim() });
      },
      Math.max(0, debounceMilliseconds),
    );
    return () => window.clearTimeout(timer);
  }, [commitQuery, debounceMilliseconds, query, search]);

  const table = useTable(
    {
      columns,
      data: rows,
      enableMultiSort: false,
      enableRowRangeSelection: false,
      enableRowSelection: Boolean(selection),
      features: serverTableFeatures,
      getRowId: (row) => stableTableRowId(adapter.getRowIdentifier(row)),
      manualPagination: true,
      manualSorting: true,
      onPaginationChange: (update) => {
        const next = resolveUpdate(update, pagination);
        commitQuery({
          ...query,
          page: next.pageSize === pagination.pageSize ? next.pageIndex + 1 : 1,
          perPage: next.pageSize,
        });
      },
      onRowSelectionChange: (update) => {
        if (!selection) return;
        const next = resolveUpdate(update, rowSelection);
        selection.onChange(
          Object.keys(next).flatMap((key) => {
            const identifier = visibleIdentifierByKey.get(key);
            return next[key] && identifier !== undefined ? [identifier] : [];
          }),
        );
      },
      onSortingChange: (update) => {
        const next = resolveUpdate(update, sorting)[0];
        commitQuery({
          ...query,
          page: 1,
          sort:
            next && adapter.sortableColumns[next.id]
              ? { columnId: next.id, direction: next.desc ? "desc" : "asc" }
              : null,
        });
      },
      rowCount: result?.page.total ?? 0,
      sortDescFirst: false,
      state: {
        columnPinning: {
          end: [...(adapter.pinnedColumns?.end ?? [])],
          start: [...(adapter.pinnedColumns?.start ?? [])],
        },
        pagination,
        rowSelection,
        sorting,
      },
    },
    (state) => ({
      columnPinning: state.columnPinning,
      pagination: state.pagination,
      rowSelection: state.rowSelection,
      sorting: state.sorting,
    }),
  );

  const headers: readonly Header<ServerTableFeatures, TData, unknown>[] = [
    ...table.getStartLeafHeaders(),
    ...table.getCenterLeafHeaders(),
    ...table.getEndLeafHeaders(),
  ];
  const setFilter = (filterId: string, value: ServerFilterValue | undefined) => {
    if (!adapter.filters?.[filterId]) return;
    const filters = { ...query.filters };
    if (value === undefined || value === "") delete filters[filterId];
    else filters[filterId] = value;
    commitQuery({ ...query, filters, page: 1 });
  };

  const pageCount = Math.max(1, result?.page.lastPage ?? table.getPageCount());
  const allowedPageSizes = [...new Set([...pageSizeOptions, query.perPage])]
    .filter((size) => Number.isInteger(size) && size > 0 && size <= (adapter.maxPerPage ?? 100))
    .sort((left, right) => left - right);

  return (
    <section aria-busy={loading} data-server-table="controlled">
      <div className="d-flex flex-wrap align-items-end gap-3 mb-3">
        {searchable ? (
          <div className="flex-grow-1">
            <label className="form-label" htmlFor="server-table-search">
              {copy.search}
            </label>
            <input
              className="form-control"
              id="server-table-search"
              onChange={(event) =>
                setSearchDraft({ committed: query.search, value: event.target.value })
              }
              type="search"
              value={search}
            />
          </div>
        ) : null}
        {filterControls?.({ filters: query.filters, setFilter })}
      </div>

      {loading && rows.length === 0 ? <LoadingState locale={locale} /> : null}
      {error ? <ErrorState error={error} locale={locale} onRetry={onRetry} /> : null}
      {!loading && !error && rows.length === 0 ? (
        <EmptyState description={copy.empty} locale={locale} />
      ) : null}

      {rows.length > 0 ? (
        <>
          {selection ? (
            <output className="small text-muted d-block mb-2">
              {copy.selectedCount}: {formatProductNumber(rowSelectionCount(rowSelection), locale)}
            </output>
          ) : null}
          <div className="table-responsive" data-table-viewport="responsive">
            <table className="table table-hover align-middle mb-0">
              <thead>
                <tr>
                  {selection ? (
                    <th scope="col">
                      <span className="visually-hidden">{copy.selectRow}</span>
                    </th>
                  ) : null}
                  {headers.map((header) => {
                    const sortable = Boolean(adapter.sortableColumns[header.column.id]);
                    const nextDirection =
                      header.column.getIsSorted() === "asc"
                        ? copy.sortDescending
                        : copy.sortAscending;
                    return (
                      <th
                        aria-sort={sortable ? ariaSort(header.column) : undefined}
                        key={header.id}
                        scope="col"
                        style={pinnedStyle(header.column)}
                      >
                        {sortable ? (
                          <button
                            aria-label={`${nextDirection}: ${typeof header.column.columnDef.header === "string" ? header.column.columnDef.header : header.column.id}`}
                            className="btn btn-link link-body-emphasis p-0 text-decoration-none"
                            onClick={header.column.getToggleSortingHandler()}
                            type="button"
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            <span aria-hidden="true" className="ms-1">
                              {header.column.getIsSorted() === "asc"
                                ? "↑"
                                : header.column.getIsSorted() === "desc"
                                  ? "↓"
                                  : "↕"}
                            </span>
                          </button>
                        ) : (
                          flexRender(header.column.columnDef.header, header.getContext())
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => {
                  const cells: readonly Cell<ServerTableFeatures, TData, unknown>[] = [
                    ...row.getStartVisibleCells(),
                    ...row.getCenterVisibleCells(),
                    ...row.getEndVisibleCells(),
                  ];
                  return (
                    <tr key={row.id}>
                      {selection ? (
                        <td>
                          <input
                            aria-label={`${copy.selectRow}: ${row.id}`}
                            checked={row.getIsSelected()}
                            className="form-check-input"
                            onChange={row.getToggleSelectedHandler()}
                            type="checkbox"
                          />
                        </td>
                      ) : null}
                      {cells.map((cell) => (
                        <td key={cell.id} style={pinnedStyle(cell.column)}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mt-3">
        <label className="d-flex align-items-center gap-2">
          <span>{copy.pageSize}</span>
          <select
            aria-label={copy.pageSize}
            className="form-select form-select-sm w-auto"
            onChange={(event) => table.setPageSize(Number(event.target.value))}
            value={query.perPage}
          >
            {allowedPageSizes.map((size) => (
              <option key={size} value={size}>
                {formatProductNumber(size, locale)}
              </option>
            ))}
          </select>
        </label>
        <output className="small">
          {copy.page} {formatProductNumber(query.page, locale)} /{" "}
          {formatProductNumber(pageCount, locale)}
        </output>
        <nav aria-label={copy.page} className="btn-group" role="navigation">
          <button
            className="btn btn-outline-secondary btn-sm"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.firstPage()}
            type="button"
          >
            <span aria-hidden="true">«</span>
            <span className="visually-hidden">{copy.firstPage}</span>
          </button>
          <button
            className="btn btn-outline-secondary btn-sm"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
            type="button"
          >
            <span aria-hidden="true">‹</span>
            <span className="visually-hidden">{copy.previousPage}</span>
          </button>
          <button
            className="btn btn-outline-secondary btn-sm"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
            type="button"
          >
            <span aria-hidden="true">›</span>
            <span className="visually-hidden">{copy.nextPage}</span>
          </button>
          <button
            className="btn btn-outline-secondary btn-sm"
            disabled={!table.getCanLastPage()}
            onClick={() => table.lastPage()}
            type="button"
          >
            <span aria-hidden="true">»</span>
            <span className="visually-hidden">{copy.lastPage}</span>
          </button>
        </nav>
      </div>
    </section>
  );
};

const rowSelectionCount = (selection: RowSelectionState) =>
  Object.values(selection).filter(Boolean).length;
