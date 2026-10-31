import { fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import FullScreenDropdown from "../Components/Common/FullScreenDropdown";
import RightSidebar from "../Components/Common/RightSidebar";
import SearchOption from "../Components/Common/SearchOption";
import Header from "./Header";
import Layout from "./index";
import Sidebar from "./Sidebar";
import { ShellAuthProvider, useShellAuth } from "./ShellAuthContext";
import { changeProductLanguage } from "../i18n";
import BestSellingProducts from "../pages/DashboardEcommerce/BestSellingProducts";
import RecentOrders from "../pages/DashboardEcommerce/RecentOrders";
import DashboardSection from "../pages/DashboardEcommerce/Section";
import { store } from "../store";

const { useProfile } = vi.hoisted(() => ({
  useProfile: vi.fn(() => ({
    authError: null,
    capabilities: {
      accessAdminPanel: true,
      accessRootAdmin: false,
    },
    denial: null,
    isAuthenticated: true,
    loading: false,
    userProfile: {
      id: 1,
      name: "Shell Admin",
      roles: ["admin"],
    },
  })),
}));

vi.mock("../Components/Hooks/UserHooks", () => ({ useProfile }));

const AuthConsumer = ({ label }: { label: string }) => {
  const { userProfile } = useShellAuth();
  return <output aria-label={label}>{userProfile?.name}</output>;
};

describe("retained shell lifecycle", () => {
  it("imports browser-facing shell modules without touching missing DOM nodes", () => {
    expect([Layout, Header, Sidebar, SearchOption, RightSidebar]).not.toContain(undefined);
  });

  it("fans one shell auth snapshot out to every shell consumer", () => {
    render(
      <ShellAuthProvider>
        <AuthConsumer label="first" />
        <AuthConsumer label="second" />
      </ShellAuthProvider>,
    );

    expect(useProfile).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("first")).toHaveTextContent("Shell Admin");
    expect(screen.getByLabelText("second")).toHaveTextContent("Shell Admin");
  });

  it("removes fullscreen listeners when the control unmounts", () => {
    const add = vi.spyOn(document, "addEventListener");
    const remove = vi.spyOn(document, "removeEventListener");
    const { unmount } = render(<FullScreenDropdown />);

    const fullscreenAdds = add.mock.calls.filter(([eventName]) =>
      String(eventName).includes("fullscreenchange"),
    );
    expect(fullscreenAdds).toHaveLength(3);

    unmount();
    const fullscreenRemovals = remove.mock.calls.filter(([eventName]) =>
      String(eventName).includes("fullscreenchange"),
    );
    expect(fullscreenRemovals).toHaveLength(3);
  });

  it("translates the restored Velzon customizer in place when language changes", async () => {
    await changeProductLanguage("en");
    render(
      <Provider store={store}>
        <MemoryRouter>
          <RightSidebar />
        </MemoryRouter>
      </Provider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Theme Customizer" }));
    expect(screen.getByText("Theme Customizer")).toBeInTheDocument();
    expect(screen.getByText("Choose your layout")).toBeInTheDocument();

    await changeProductLanguage("fa");

    expect(await screen.findByText("سفارشی‌سازی پوسته")).toBeInTheDocument();
    expect(screen.getByText("طرح‌بندی را انتخاب کنید.")).toBeInTheDocument();
    expect(document.documentElement.dir).toBe("rtl");

    await changeProductLanguage("en");
  });

  it("uses the authenticated identity in the unchanged dashboard heading", async () => {
    await changeProductLanguage("en");
    render(
      <ShellAuthProvider>
        <DashboardSection rightClickBtn={vi.fn()} />
      </ShellAuthProvider>,
    );

    expect(screen.getByText("Good Morning, Shell Admin!")).toBeInTheDocument();

    await changeProductLanguage("fa");

    expect(await screen.findByText("صبح بخیر، Shell Admin!")).toBeInTheDocument();
    await changeProductLanguage("en");
  });

  it("translates retained dashboard labels without changing fixture values", async () => {
    await changeProductLanguage("en");
    render(
      <MemoryRouter>
        <BestSellingProducts />
        <RecentOrders />
      </MemoryRouter>,
    );

    expect(screen.getByText("Best Selling Products")).toBeInTheDocument();
    expect(screen.getByText("Recent Orders")).toBeInTheDocument();
    expect(screen.getAllByText("Paid")).not.toHaveLength(0);

    await changeProductLanguage("fa");

    expect(await screen.findByText("پرفروش‌ترین محصولات")).toBeInTheDocument();
    expect(screen.getByText("سفارش‌های اخیر")).toBeInTheDocument();
    expect(screen.getAllByText("پرداخت‌شده")).not.toHaveLength(0);
    expect(screen.getByText("#VZ2112")).toBeInTheDocument();
    await changeProductLanguage("en");
  });
});
