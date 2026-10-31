import { render, screen, waitFor } from "@testing-library/react";
import { Suspense } from "react";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { authProtectedRoutes } from "../Routes/allRoutes";
import { rootAdminOnly } from "../Routes/routeTypes";
import { store } from "../store";

describe("root toolbox lazy runtime boundary", () => {
  it("installs retained reducers before rendering a real toolbox page", async () => {
    const toolboxEntryRoute = authProtectedRoutes.find(
      (route) => route.path === "dev/*",
    );

    expect(toolboxEntryRoute).toBeDefined();
    expect(toolboxEntryRoute?.allowedRoles).toBe(rootAdminOnly);
    expect(store.getState()).not.toHaveProperty("Calendar");

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={["/dev/pages-starter"]}>
          <Suspense fallback={<p>Loading toolbox</p>}>
            <Routes>
              <Route path={toolboxEntryRoute!.path} element={toolboxEntryRoute!.component} />
            </Routes>
          </Suspense>
        </MemoryRouter>
      </Provider>,
    );

    await waitFor(() => expect(store.getState()).toHaveProperty("Calendar"), { timeout: 5000 });
    expect(await screen.findAllByText("Starter", {}, { timeout: 5000 })).not.toHaveLength(0);
  });
});
