import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyProductLocale } from "../preferences/localization";
import { FileSelectionField, SafeFileList, type SafeFileMetadata } from "./FilePresentation";

const files: readonly SafeFileMetadata[] = [
  {
    available: true,
    createdAt: "2026-08-26T09:30:00Z",
    label: "نتیجه آزمایش",
    mimeType: "application/pdf",
    publicId: "01FILESAFE",
    sizeBytes: 12_288,
  },
  {
    available: false,
    createdAt: null,
    label: null,
    mimeType: "image/png",
    publicId: "01FILEUNAVAILABLE",
    sizeBytes: 2048,
  },
];

beforeEach(() => applyProductLocale(document.documentElement, "fa"));

describe("file presentation primitives", () => {
  it("keeps browser constraints as visible hints and still reports the selected file", () => {
    const onSelect = vi.fn<(file: File | null) => void>();
    const candidate = new File([new Uint8Array(2048)], "<result>.pdf", {
      type: "application/pdf",
    });
    render(
      <FileSelectionField
        accept={["application/pdf", "image/jpeg", "image/png"]}
        id="medical-file"
        maxSizeBytesHint={1024}
        onSelect={onSelect}
        selectedFile={candidate}
      />,
    );

    const input = screen.getByLabelText("انتخاب فایل");
    expect(input).toHaveAttribute("accept", "application/pdf,image/jpeg,image/png");
    expect(input).toHaveAccessibleDescription(/پذیرش نهایی را سرور تعیین می‌کند/);
    expect(screen.getByText("<result>.pdf")).toBeVisible();
    expect(screen.getByText(/حد پیشنهادی مرورگر/)).toBeVisible();

    fireEvent.change(input, { target: { files: [candidate] } });
    expect(onSelect).toHaveBeenCalledWith(candidate);
  });

  it.each([
    ["fa", "rtl", "انتخاب فایل"],
    ["en", "ltr", "Choose a file"],
  ] as const)("inherits %s document direction", (locale, direction, label) => {
    applyProductLocale(document.documentElement, locale);
    const { container } = render(
      <FileSelectionField
        id="file"
        locale={locale}
        onSelect={vi.fn<(file: File | null) => void>()}
      />,
    );

    expect(document.documentElement).toHaveAttribute("dir", direction);
    expect(container.firstElementChild).not.toHaveAttribute("dir");
    expect(screen.getByLabelText(label)).toBeVisible();
  });

  it("renders only safe server metadata and opens only an available file", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn<(file: SafeFileMetadata) => void>();
    const { container } = render(<SafeFileList files={files} onOpen={onOpen} />);

    expect(screen.getByText("نتیجه آزمایش")).toBeVisible();
    expect(screen.getByText("در دسترس نیست")).toBeVisible();
    expect(screen.getAllByRole("button", { name: "مشاهده فایل" })).toHaveLength(1);
    expect(container).not.toHaveTextContent("01FILESAFE");
    expect(container).not.toHaveTextContent("scan");

    await user.click(screen.getByRole("button", { name: "مشاهده فایل" }));
    expect(onOpen).toHaveBeenCalledWith(files[0]);
  });

  it("escapes unsafe-looking labels and survives malformed display metadata", () => {
    const { container } = render(
      <SafeFileList
        files={[
          {
            available: true,
            createdAt: "not-a-time",
            label: '<img src=x onerror="alert(1)">',
            mimeType: "text/<script>",
            publicId: "01MALFORMED",
            sizeBytes: Number.NaN,
          },
        ]}
      />,
    );

    expect(screen.getByText('<img src=x onerror="alert(1)">')).toBeVisible();
    expect(screen.getByText(/text\/<script>/)).toBeVisible();
    expect(screen.getByText(/زمان نامشخص/)).toBeVisible();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
  });

  it("uses the shared empty and safe retry error states", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn<() => void>();
    const { rerender } = render(<SafeFileList files={[]} />);
    expect(screen.getByText("اطلاعات فایلی برای نمایش وجود ندارد.")).toBeVisible();

    rerender(
      <SafeFileList error={new Error("network unavailable")} files={[]} onRetry={onRetry} />,
    );
    await user.click(screen.getByRole("button", { name: "تلاش دوباره" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
