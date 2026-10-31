import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("../Components/Common/ToolboxClassicEditor", () => ({
  default: () => <div data-testid="ckeditor-placeholder" />,
}));

import FormEditor from "../pages/Forms/FormEditor/FormEditor";

describe("retained editor toolbox runtime", () => {
  it("constructs the Quill 2 editor without collapsing the combined editor page", async () => {
    const { container, getByTestId } = render(
      <MemoryRouter>
        <FormEditor />
      </MemoryRouter>,
    );

    expect(getByTestId("ckeditor-placeholder")).toBeInTheDocument();
    await waitFor(() => expect(container.querySelector(".ql-container")).toBeInTheDocument());
    expect(container.querySelector(".ql-editor")).toBeInTheDocument();
  });
});
