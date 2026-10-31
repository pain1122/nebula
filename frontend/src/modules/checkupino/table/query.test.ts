import { describe, expect, it } from "vitest";

import type { ServerTableEndpointAdapter } from "./contracts";
import { routeIdentifierForRow, stableTableRowId } from "./contracts";
import {
  createDefaultServerTableQuery,
  parseServerTableQuery,
  serializeServerTableQuery,
  serverTableBackendParameters,
} from "./query";

interface FixtureRow {
  readonly id: number;
  readonly publicId: string;
}

const adapter: ServerTableEndpointAdapter<FixtureRow> = {
  defaultPerPage: 20,
  filters: {
    active: {
      parameter: "active",
      parse: (value) => (value === "1" ? true : value === "0" ? false : undefined),
      serialize: (value) => (value === true ? "1" : value === false ? "0" : undefined),
    },
    role: { parameter: "role" },
  },
  getRouteIdentifier: (row) => row.publicId,
  getRowIdentifier: (row) => row.id,
  maxPerPage: 50,
  sortableColumns: {
    createdAt: "created_at",
    name: "name",
  },
};

describe("server table query contract", () => {
  it("parses only endpoint-allowlisted filters and sorting", () => {
    const query = parseServerTableQuery(
      new URLSearchParams(
        "page=3&per_page=500&q=%20%D8%B9%D9%84%DB%8C%20&sort_by=created_at&sort_dir=desc&active=1&role=admin&permission=all",
      ),
      adapter,
    );

    expect(query).toEqual({
      filters: { active: true, role: "admin" },
      page: 3,
      perPage: 50,
      search: "علی",
      sort: { columnId: "createdAt", direction: "desc" },
    });
  });

  it("rejects an unsupported sort pair and malformed page values", () => {
    expect(
      parseServerTableQuery(
        new URLSearchParams("page=-2&per_page=nope&sort_by=password&sort_dir=asc"),
        adapter,
      ),
    ).toEqual(createDefaultServerTableQuery(adapter));
  });

  it("serializes a deterministic backend-compatible allowlisted query", () => {
    const query = {
      filters: { active: false, ignored: "unsafe" },
      page: 2,
      perPage: 50,
      search: "  پزشک  ",
      sort: { columnId: "name", direction: "asc" } as const,
    };

    expect(serializeServerTableQuery(query, adapter).toString()).toBe(
      "page=2&per_page=50&q=%D9%BE%D8%B2%D8%B4%DA%A9&sort_by=name&sort_dir=asc&active=0",
    );
    expect(serverTableBackendParameters(query, adapter)).toEqual({
      active: "0",
      page: "2",
      per_page: "50",
      q: "پزشک",
      sort_by: "name",
      sort_dir: "asc",
    });
  });

  it("keeps table identity collision-safe and route identity uncoerced", () => {
    const row = { id: 12, publicId: "01HZZPUBLIC" };

    expect(stableTableRowId(12)).toBe("number:12");
    expect(stableTableRowId("12")).toBe("string:12");
    expect(routeIdentifierForRow(row, adapter)).toBe("01HZZPUBLIC");
  });
});
