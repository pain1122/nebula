import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { changeProductLanguage } from "../../i18n";
import { resetRegisterFlagChange } from "../../slices/auth/register/reducer";
import { store } from "../../store";
import ForgetPasswordPage from "./ForgetPassword";
import Register from "./Register";
import UserProfile from "./user-profile";

vi.mock("../../Components/Hooks/UserHooks", () => ({
  useProfile: () => ({
    loading: false,
    userProfile: {
      email: "admin@example.test",
      id: 7,
      name: "Velzon Admin",
      roles: ["admin"],
    },
  }),
}));

const renderRoute = (component: React.ReactNode) =>
  render(
    <Provider store={store}>
      <MemoryRouter>{component}</MemoryRouter>
    </Provider>,
  );

afterEach(async () => {
  store.dispatch(resetRegisterFlagChange());
  await changeProductLanguage("en");
});

describe("restored authentication localization", () => {
  it("translates the existing forgot-password surface in place", async () => {
    await changeProductLanguage("en");
    renderRoute(<ForgetPasswordPage />);

    expect(screen.getByRole("heading", { name: "Forgot Password?" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter email")).toBeInTheDocument();

    await changeProductLanguage("fa");

    expect(
      await screen.findByRole("heading", { name: "رمز عبور را فراموش کرده‌اید؟" }),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("ایمیل را وارد کنید")).toBeInTheDocument();
  });

  it("translates registration and releases loading after the unavailable action fails", async () => {
    const user = userEvent.setup();
    await changeProductLanguage("fa");
    const { container } = renderRoute(<Register />);

    expect(screen.getByRole("heading", { name: "ایجاد حساب جدید" })).toBeInTheDocument();

    await user.type(container.querySelector<HTMLInputElement>('input[name="email"]')!, "a@b.test");
    await user.type(
      container.querySelector<HTMLInputElement>('input[name="first_name"]')!,
      "admin",
    );
    await user.type(
      container.querySelector<HTMLInputElement>('input[name="password"]')!,
      "secret-value",
    );
    await user.type(
      container.querySelector<HTMLInputElement>('input[name="confirm_password"]')!,
      "secret-value",
    );
    await user.click(screen.getByRole("button", { name: "ثبت‌نام" }));

    expect(
      await screen.findByText("این ایمیل قبلاً ثبت شده است. از ایمیل دیگری استفاده کنید."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ثبت‌نام" })).toBeEnabled();
  });

  it("translates the restored profile labels while preserving session identity", async () => {
    await changeProductLanguage("en");
    renderRoute(<UserProfile />);

    expect(screen.getByText("Velzon Admin")).toBeInTheDocument();
    expect(screen.getByText("Email Id: admin@example.test")).toBeInTheDocument();
    expect(screen.getByText("Change User Name")).toBeInTheDocument();

    await changeProductLanguage("fa");

    expect(await screen.findByText("ایمیل: admin@example.test")).toBeInTheDocument();
    expect(screen.getByText("تغییر نام کاربری")).toBeInTheDocument();
    expect(screen.getByText("Velzon Admin")).toBeInTheDocument();
  });
});
