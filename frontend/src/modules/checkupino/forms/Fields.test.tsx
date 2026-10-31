import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { applyProductLocale } from "../preferences/localization";
import { DateField, FileField, SelectField, TextareaField, TextField } from "./Fields";

describe("typed field primitives", () => {
  it("associates Farsi-first label, required, help, and server-error states", () => {
    render(
      <TextField
        errorMessages={["شماره همراه معتبر نیست."]}
        helpText="شماره را با صفر وارد کنید."
        id="mobile"
        label="شماره همراه"
        name="mobile"
        required
      />,
    );

    const input = screen.getByRole("textbox", { name: /شماره همراه/ });
    expect(input).toBeRequired();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("شماره را با صفر وارد کنید. شماره همراه معتبر نیست.");
    expect(screen.getByText(/الزامی/)).toHaveClass("visually-hidden");
  });

  it.each([
    ["fa", "rtl"],
    ["en", "ltr"],
  ] as const)("inherits the %s document direction without local overrides", (locale, direction) => {
    applyProductLocale(document.documentElement, locale);
    render(<TextField id="name" label="Name" locale={locale} name="name" />);

    const input = screen.getByRole("textbox", { name: "Name" });
    expect(document.documentElement).toHaveAttribute("dir", direction);
    expect(input).not.toHaveAttribute("dir");
  });

  it("normalizes Persian and Arabic-Indic digits before forwarding change", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<(event: React.ChangeEvent<HTMLInputElement>) => void>();
    render(<TextField id="code" label="کد" name="code" normalizeDigits onChange={onChange} />);

    const input = screen.getByRole("textbox", { name: "کد" });
    await user.type(input, "۱۲٣");

    expect(input).toHaveValue("123");
    expect(onChange).toHaveBeenCalled();
  });

  it("keeps native keyboard order across all approved field seams", async () => {
    const user = userEvent.setup();
    render(
      <form>
        <TextField id="title" label="عنوان" name="title" />
        <SelectField
          id="status"
          label="وضعیت"
          name="status"
          options={[{ label: "فعال", value: "active" }]}
        />
        <TextareaField id="notes" label="توضیحات" name="notes" />
        <DateField id="date" label="تاریخ" name="date" />
        <FileField id="file" label="فایل" name="file" />
      </form>,
    );

    for (const label of ["عنوان", "وضعیت", "توضیحات", "تاریخ", "فایل"]) {
      await user.tab();
      expect(screen.getByLabelText(label)).toHaveFocus();
    }
  });

  it("uses localized select placeholders without changing option values", () => {
    render(
      <SelectField
        id="role"
        label="نقش"
        name="role"
        options={[{ label: "مدیر", value: "admin" }]}
      />,
    );

    expect(screen.getByRole("option", { name: "انتخاب کنید" })).toHaveValue("");
    expect(screen.getByRole("option", { name: "مدیر" })).toHaveValue("admin");
  });
});
