import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import type { RoleName } from "../types/auth";
import AuthProtected from "./AuthProtected";
import { rootAdminOnly } from "./routeTypes";

const { profile } = vi.hoisted(() => ({
  profile: {
    roles: ["admin"] as RoleName[],
  },
}));

vi.mock("../Components/Hooks/UserHooks", () => ({
  useProfile: () => ({
    loading: false,
    userProfile: profile,
  }),
}));

const renderToolboxGuard = (roles: RoleName[]) => {
  profile.roles = roles;

  render(
    <MemoryRouter initialEntries={["/dev/widgets"]}>
      <Routes>
        <Route
          path="/dev/widgets"
          element={
            <AuthProtected allowedRoles={rootAdminOnly}>
              <p>toolbox content</p>
            </AuthProtected>
          }
        />
        <Route path="/" element={<p>product dashboard</p>} />
        <Route path="/login" element={<p>admin login</p>} />
        <Route path="/doctor/reservations" element={<p>doctor panel</p>} />
      </Routes>
    </MemoryRouter>,
  );
};

describe("root toolbox route authority", () => {
  it("allows root administrators", () => {
    renderToolboxGuard(["root-admin"]);
    expect(screen.getByText("toolbox content")).toBeInTheDocument();
  });

  it("redirects ordinary administrators to the product dashboard", () => {
    renderToolboxGuard(["admin"]);
    expect(screen.getByText("product dashboard")).toBeInTheDocument();
  });

  it("redirects doctors to their own panel without granting toolbox access", () => {
    renderToolboxGuard(["doctor"]);
    expect(screen.getByText("product dashboard")).toBeInTheDocument();
    expect(screen.queryByText("toolbox content")).toBeNull();
  });
});
