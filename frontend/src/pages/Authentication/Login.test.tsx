import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import "../../i18n";
import Login from "./Login";

const { useProfile } = vi.hoisted(() => ({
  useProfile: vi.fn(() => ({
    authError: null,
    denial: null,
    isAuthenticated: false,
    loading: false,
    userProfile: null,
  })),
}));

vi.mock("../../Components/Hooks/UserHooks", () => ({ useProfile }));

describe("Velzon login integration", () => {
  it("retains typed field values after React releases each change event", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    const email = container.querySelector<HTMLInputElement>("#email");
    const password = container.querySelector<HTMLInputElement>("#password-input");
    const remember = container.querySelector<HTMLInputElement>("#auth-remember-check");

    expect(email).not.toBeNull();
    expect(password).not.toBeNull();
    expect(remember).not.toBeNull();

    await user.type(email!, "admin@example.test");
    await user.type(password!, "secret-value");
    await user.click(remember!);

    expect(email).toHaveValue("admin@example.test");
    expect(password).toHaveValue("secret-value");
    expect(remember).toBeChecked();
  });
});
