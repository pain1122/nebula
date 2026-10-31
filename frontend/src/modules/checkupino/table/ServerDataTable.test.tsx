import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyProductLocale } from "../preferences/localization";
import { adaptAdminUsersList, adaptEnvelopePaginatorList } from "../query/lists";
import { ServerDataTable, type ServerTableColumnDef } from "./ServerDataTable";
import type {
  ServerRowIdentifier,
  ServerTableEndpointAdapter,
  ServerTableQuery,
} from "./contracts";

interface FixtureRow {
  readonly id: number | string;
  readonly name: string;
  readonly public_id?: string;
}

const columns: readonly ServerTableColumnDef<FixtureRow>[] = [
  {
    accessorKey: "id",
    header: "شناسه",
    id: "id",
    size: 90,
  },
  {
    accessorKey: "name",
    header: "نام",
    id: "name",
  },
];

const adapter: ServerTableEndpointAdapter<FixtureRow> = {
  filters: {
    role: { parameter: "role" },
  },
  getRouteIdentifier: (row) => row.public_id ?? row.id,
  getRowIdentifier: (row) => row.id,
  pinnedColumns: { start: ["id"] },
  sortableColumns: { id: "id", name: "name" },
};

const query: ServerTableQuery = {
  filters: {},
  page: 1,
  perPage: 20,
  search: "",
  sort: null,
};

const rows: readonly FixtureRow[] = [
  { id: 1, name: "زهره", public_id: "01-Z" },
  { id: "1", name: "آرش", public_id: "01-A" },
];

const result = {
  items: rows,
  page: { currentPage: 1, lastPage: 2, perPage: 20, total: 22 },
};

beforeEach(() => {
  applyProductLocale(document.documentElement, "fa");
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
});

describe("controlled server data table", () => {
  it.each([
    ["fa", "rtl", 360],
    ["en", "ltr", 1440],
  ] as const)(
    "renders the %s fixture at %ipx without a local direction override",
    (locale, direction, width) => {
      applyProductLocale(document.documentElement, locale);
      Object.defineProperty(window, "innerWidth", { configurable: true, value: width });

      const { container } = render(
        <ServerDataTable
          adapter={adapter}
          columns={columns}
          locale={locale}
          onQueryChange={vi.fn<(query: ServerTableQuery) => void>()}
          query={query}
          result={result}
        />,
      );

      expect(document.documentElement).toHaveAttribute("dir", direction);
      expect(container.querySelector("[data-server-table]")).not.toHaveAttribute("dir");
      expect(container.querySelector("[data-table-viewport='responsive']")).toHaveClass(
        "table-responsive",
      );
      expect(screen.getByText("زهره")).toBeVisible();
      expect(screen.getByText("آرش")).toBeVisible();
      expect(screen.getByLabelText(locale === "fa" ? "جستجو" : "Search")).toBeVisible();
    },
  );

  it("uses native keyboard controls for server sorting", async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn<(query: ServerTableQuery) => void>();
    render(
      <ServerDataTable
        adapter={adapter}
        columns={columns}
        onQueryChange={onQueryChange}
        query={query}
        result={result}
      />,
    );

    await user.tab();
    expect(screen.getByRole("searchbox")).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: /مرتب‌سازی صعودی: شناسه/ })).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(onQueryChange).toHaveBeenCalledWith({
      ...query,
      sort: { columnId: "id", direction: "asc" },
    });
  });

  it("emits server sorting while preserving the server page row order", async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn<(query: ServerTableQuery) => void>();
    render(
      <ServerDataTable
        adapter={adapter}
        columns={columns}
        onQueryChange={onQueryChange}
        query={query}
        result={result}
      />,
    );

    const body = screen.getByRole("table").querySelector("tbody");
    expect(body).not.toBeNull();
    expect(
      within(body!)
        .getAllByRole("row")
        .map((row) => row.textContent),
    ).toEqual(["1زهره", "1آرش"]);

    await user.click(screen.getByRole("button", { name: /مرتب‌سازی صعودی: نام/ }));

    expect(onQueryChange).toHaveBeenCalledWith({
      ...query,
      page: 1,
      sort: { columnId: "name", direction: "asc" },
    });
    expect(
      within(body!)
        .getAllByRole("row")
        .map((row) => row.textContent),
    ).toEqual(["1زهره", "1آرش"]);
  });

  it("debounces search deterministically and cancels the stale commit", () => {
    vi.useFakeTimers();
    const onQueryChange = vi.fn<(query: ServerTableQuery) => void>();
    const { unmount } = render(
      <ServerDataTable
        adapter={adapter}
        columns={columns}
        debounceMilliseconds={300}
        onQueryChange={onQueryChange}
        query={query}
        result={result}
      />,
    );
    const search = screen.getByRole("searchbox");

    fireEvent.change(search, { target: { value: "پز" } });
    vi.advanceTimersByTime(200);
    fireEvent.change(search, { target: { value: "پزشک" } });
    vi.advanceTimersByTime(299);
    expect(onQueryChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onQueryChange).toHaveBeenCalledOnce();
    expect(onQueryChange).toHaveBeenCalledWith({ ...query, page: 1, search: "پزشک" });

    fireEvent.change(search, { target: { value: "لغو" } });
    unmount();
    vi.runAllTimers();
    expect(onQueryChange).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("keeps optional selection controlled, current-page-only, and type-stable", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn<(identifiers: readonly ServerRowIdentifier[]) => void>();
    const onQueryChange = vi.fn<(query: ServerTableQuery) => void>();
    const { rerender } = render(
      <ServerDataTable
        adapter={adapter}
        columns={columns}
        onQueryChange={onQueryChange}
        query={query}
        result={result}
        selection={{ onChange: onSelectionChange, selected: [] }}
      />,
    );

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[1]);
    expect(onSelectionChange).toHaveBeenLastCalledWith(["1"]);

    rerender(
      <ServerDataTable
        adapter={adapter}
        columns={columns}
        onQueryChange={onQueryChange}
        query={query}
        result={result}
        selection={{ onChange: onSelectionChange, selected: ["1"] }}
      />,
    );
    await user.click(screen.getByRole("button", { name: /مرتب‌سازی صعودی: نام/ }));
    expect(onSelectionChange).toHaveBeenLastCalledWith([]);
  });

  it("renders two incompatible backend list envelopes through the shared result contract", () => {
    const users = adaptAdminUsersList<FixtureRow>({
      data: { users: rows },
      meta: { pagination: { current_page: 1, last_page: 1, per_page: 20, total: 2 } },
    });
    const paginator = adaptEnvelopePaginatorList<FixtureRow>({
      data: { current_page: 1, data: rows, last_page: 1, per_page: 20, total: 2 },
    });

    const { rerender } = render(
      <ServerDataTable
        adapter={adapter}
        columns={columns}
        onQueryChange={vi.fn<(query: ServerTableQuery) => void>()}
        query={query}
        result={users}
      />,
    );
    expect(screen.getAllByRole("row")).toHaveLength(3);

    rerender(
      <ServerDataTable
        adapter={adapter}
        columns={columns}
        onQueryChange={vi.fn<(query: ServerTableQuery) => void>()}
        query={query}
        result={paginator}
      />,
    );
    expect(screen.getAllByRole("row")).toHaveLength(3);
  });

  it("uses logical start pinning and endpoint-owned filter metadata", async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn<(query: ServerTableQuery) => void>();
    const { container } = render(
      <ServerDataTable
        adapter={adapter}
        columns={columns}
        filterControls={({ setFilter }) => (
          <button onClick={() => setFilter("role", "doctor")} type="button">
            پزشک‌ها
          </button>
        )}
        onQueryChange={onQueryChange}
        query={query}
        result={result}
      />,
    );

    const pinnedHeader = container.querySelector("th[style*='inset-inline-start']");
    expect(pinnedHeader).not.toBeNull();
    expect(pinnedHeader).toHaveStyle({ insetInlineStart: "0px", position: "sticky" });

    await user.click(screen.getByRole("button", { name: "پزشک‌ها" }));
    expect(onQueryChange).toHaveBeenCalledWith({
      ...query,
      filters: { role: "doctor" },
      page: 1,
    });
  });
});
