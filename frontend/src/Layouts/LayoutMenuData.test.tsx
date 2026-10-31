import { fireEvent, render, screen } from "@testing-library/react";
import { Link, MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { NavigationMenuProvider, useNavigationMenu } from "./LayoutMenuData";

const { profile } = vi.hoisted(() => ({
  profile: { roles: ["admin"] },
}));

vi.mock("./ShellAuthContext", () => ({
  useShellAuth: () => ({ userProfile: profile }),
}));

const MenuLabels = () => {
  const items = useNavigationMenu();
  return (
    <>
      <output aria-label="navigation labels">
        {items
          .flatMap((item) => [item.label, ...(item.subItems ?? []).map((child) => child.label)])
          .join("|")}
      </output>
      {items
        .filter((item) => item.subItems)
        .map((item) => (
          <section key={item.id}>
            <button onClick={item.click} aria-expanded={item.stateVariables}>
              {item.label}
            </button>
            {item.subItems?.map((child) => (
              <Link
                key={child.id}
                to={child.link!}
                aria-current={child.active ? "page" : undefined}
              >
                {child.label}
              </Link>
            ))}
          </section>
        ))}
    </>
  );
};

const renderMenu = (path = "/") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <NavigationMenuProvider>
        <MenuLabels />
      </NavigationMenuProvider>
    </MemoryRouter>,
  );

describe("role-loaded navigation data", () => {
  it("makes the doctor's own professional profile visible and active in the care group", () => {
    profile.roles = ["doctor"];
    renderMenu("/profile");
    expect(screen.getByRole("link", { name: "doctorPractice.title" })).toHaveAttribute(
      "href",
      "/profile",
    );
    expect(screen.getByRole("link", { name: "doctorPractice.title" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("button", { name: "navigation.appointments" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.queryByRole("link", { name: "users.staff" })).toBeNull();
  });
  it("opens the correct patient query group and lets users collapse it without navigation", () => {
    profile.roles = ["patient"];
    renderMenu("/my/questionnaire?view=submissions&submission=01m4hfgan168p6q5ftp528285f");
    const group = screen.getByRole("button", { name: "navigation.questionnaires" });
    expect(group).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "questionnaire.history" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "questionnaire.available" })).not.toHaveAttribute(
      "aria-current",
    );
    fireEvent.click(group);
    expect(group).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(group);
    expect(group).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByRole("link", { name: "questionnaire.available" }));
    expect(screen.getByRole("link", { name: "questionnaire.available" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "questionnaire.history" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(group).toHaveAttribute("aria-expanded", "true");
  });
  it("opens a clinical detail's containing group without exposing root-only links", () => {
    profile.roles = ["admin"];
    renderMenu("/medical-requests/01m4hfgan168p6q5ftp528285f");
    expect(screen.getByRole("button", { name: "navigation.appointments" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("link", { name: "adminManage.medical-requests" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.queryByRole("link", { name: "users.staff" })).toBeNull();
  });
  it("links Add article and marks only the creation entry active", () => {
    profile.roles = ["admin"];
    renderMenu("/articles/new");
    expect(screen.getByRole("link", { name: "adminManage.article-create" })).toHaveAttribute(
      "href",
      "/articles/new",
    );
    expect(screen.getByRole("link", { name: "adminManage.article-create" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "adminManage.articles" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.getByRole("button", { name: "navigation.content" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });
  it("keeps ordinary admins on product-only navigation", () => {
    profile.roles = ["admin"];
    renderMenu();

    expect(screen.getByLabelText("navigation labels")).toHaveTextContent(
      "product.navigation.productAdmin|product.navigation.home|navigation.appointments|adminReservations.title|adminManage.schedules|adminManage.medical-requests|navigation.questionnaires|adminManage.questionnaires|adminManage.questionnaire-submissions|navigation.people|adminManage.doctors|adminManage.patients",
    );
    expect(screen.getByLabelText("navigation labels")).not.toHaveTextContent(
      "product.navigation.system",
    );
    expect(screen.getByLabelText("navigation labels")).not.toHaveTextContent("Developer Toolbox");
    expect(screen.getByLabelText("navigation labels")).not.toHaveTextContent(
      "generalSettings.title",
    );
    expect(screen.getByLabelText("navigation labels")).not.toHaveTextContent(
      "product.navigation.uploadLimits",
    );
  });

  it("loads the retained toolbox contribution for root administrators", async () => {
    profile.roles = ["root-admin"];
    renderMenu();

    const labels = await screen.findByText(/Developer Toolbox/);
    expect(labels).toHaveTextContent(
      "navigation.settings|generalSettings.title|product.navigation.uploadLimits|Developer Toolbox",
    );
    expect(labels).toHaveTextContent("users.staff");
    expect(labels).not.toHaveTextContent("product.navigation.system");
  });
});
