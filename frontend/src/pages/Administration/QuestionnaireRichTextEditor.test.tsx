import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { changeProductLanguage } from "../../i18n";
import { QUESTIONNAIRE_RICH_TEXT_LIMIT, questionnaireRichHtml } from "./questionnaireRichHtml";

const runtime = vi.hoisted(() => ({
  props: null as null | {
    data: string;
    disabled: boolean;
    config: { language: { ui: string; content: string } };
    onReady: (editor: unknown) => void;
    onChange: (event: unknown, editor: unknown) => void;
    onError: () => void;
  },
}));
vi.mock("@ckeditor/ckeditor5-react", () => ({
  CKEditor: (props: NonNullable<typeof runtime.props>) => {
    runtime.props = props;
    return <div data-testid="native-editor" />;
  },
}));
vi.mock("ckeditor5", () =>
  Object.fromEntries(
    [
      "Autoformat",
      "Image",
      "ImageCaption",
      "ImageStyle",
      "ImageToolbar",
      "ImageUpload",
      "Indent",
      "MediaEmbed",
      "PasteFromOffice",
      "Table",
      "TableToolbar",
      "BlockQuote",
      "Bold",
      "ClassicEditor",
      "Essentials",
      "Heading",
      "Italic",
      "Link",
      "List",
      "Paragraph",
      "Underline",
    ].map((name) => [
      name,
      class {
        static readonly pluginName = name;
      },
    ]),
  ),
);
import QuestionnaireRichTextEditor from "./QuestionnaireRichTextEditor";
import { questionnaireEditorConfig } from "../../Components/Common/ToolboxClassicEditor";

const engine = (html: string, root = document.createElement("div")) => {
  return {
    getData: () => html,
    editing: {
      view: {
        document: { getRoot: () => root },
        change: (
          callback: (writer: {
            setAttribute: (key: string, value: string, target: Element) => void;
          }) => void,
        ) => callback({ setAttribute: (key, value, target) => target.setAttribute(key, value) }),
      },
    },
    ui: { getEditableElement: () => root },
  };
};
beforeEach(async () => {
  runtime.props = null;
  await changeProductLanguage("en");
});
describe("questionnaire visual content editor", () => {
  it("shows only formats accepted by the server, with native bilingual UI and no upload/source/embed controls", () => {
    const config = questionnaireEditorConfig("fa");
    expect(config.language).toEqual({ ui: "fa", content: "fa" });
    expect(config.translations).toHaveLength(1);
    expect(questionnaireEditorConfig("en").translations).toBeUndefined();
    expect(config.toolbar).toEqual([
      "undo",
      "redo",
      "|",
      "heading",
      "|",
      "bold",
      "italic",
      "underline",
      "|",
      "bulletedList",
      "numberedList",
      "blockQuote",
      "link",
    ]);
    expect(
      config.plugins?.map((plugin) => (typeof plugin === "string" ? plugin : plugin.pluginName)),
    ).not.toContain("ImageUpload");
    expect(config.licenseKey).toBe("GPL");
  });
  it("prepares inert safe formatted content before the editor sees it", () => {
    const input =
      '<h2 onclick="attack()">Title</h2><p><strong>Bold</strong> <em>Italic</em><u>Underlined</u><a href="https://example.test/help" title="Help" target="_blank">Help</a></p><script>never execute</script><img src="https://external.test/image" onerror="attack()"><iframe src="https://external.test"></iframe><svg onload="attack()"><text>bad</text></svg>';
    const safe = questionnaireRichHtml(input);
    expect(safe).toContain("<h2>Title</h2>");
    expect(safe).toContain("<strong>Bold</strong>");
    expect(safe).toContain("<em>Italic</em>");
    expect(safe).toContain("<u>Underlined</u>");
    expect(safe).toContain('<a href="https://example.test/help" title="Help">Help</a>');
    expect(safe).not.toMatch(/onclick|target=|script|img|iframe|svg|external|never execute/);
    expect(questionnaireRichHtml("<ol><li>A</li></ol><blockquote>Quote</blockquote>")).toBe(
      "<ol><li>A</li></ol><blockquote>Quote</blockquote>",
    );
  });
  it.each([
    "javascript:alert(1)",
    "&#106;avascript:alert(1)",
    "data:text/html,bad",
    "/relative",
    "//external.test",
  ])("removes unsafe or relative links: %s", (href) => {
    expect(questionnaireRichHtml('<p><a href="' + href + '">Readable</a></p>')).toBe(
      "<p><a>Readable</a></p>",
    );
  });
  it("blocks excessive content instead of silently truncating it", () => {
    expect(() => questionnaireRichHtml("x".repeat(QUESTIONNAIRE_RICH_TEXT_LIMIT + 1))).toThrow(
      RangeError,
    );
  });
  it("blocks save until ready, emits formatted content, respects confirmation disabling and closes on editor failure", async () => {
    const onChange = vi.fn<(html: string | null) => void>(),
      validity = vi.fn<(valid: boolean | null) => void>();
    const props = {
      id: "intro",
      label: "Introduction",
      value: "<p>Saved <strong>format</strong></p>",
      disabled: false,
      onChange,
      onValidityChange: validity,
    };
    const { rerender } = render(<QuestionnaireRichTextEditor {...props} />);
    expect(validity).toHaveBeenLastCalledWith(false);
    expect(runtime.props?.data).toBe(props.value);
    const native = engine(props.value);
    act(() => runtime.props?.onReady(native));
    expect(native.ui.getEditableElement()).toHaveAttribute("id", "intro");
    expect(native.ui.getEditableElement()).toHaveAttribute("aria-labelledby", "intro-label");
    expect(validity).toHaveBeenLastCalledWith(true);
    act(() => runtime.props?.onChange({}, engine("<p><em>Edited</em></p>")));
    expect(onChange).toHaveBeenLastCalledWith("<p><em>Edited</em></p>");
    rerender(<QuestionnaireRichTextEditor {...props} value="<p><em>Edited</em></p>" />);
    expect(runtime.props?.data).toBe(props.value);
    rerender(<QuestionnaireRichTextEditor {...props} disabled />);
    expect(runtime.props?.disabled).toBe(true);
    act(() => runtime.props?.onChange({}, engine("<p>must not change</p>")));
    expect(onChange).toHaveBeenCalledTimes(1);
    act(() => runtime.props?.onError());
    expect(await screen.findByRole("alert")).toBeVisible();
    expect(validity).toHaveBeenLastCalledWith(false);
    expect(screen.queryByTestId("native-editor")).toBeNull();
  });
  it("keeps over-limit edits unsaved until shortened and sets the actual editable label/direction", async () => {
    const onChange = vi.fn<(html: string | null) => void>(),
      validity = vi.fn<(valid: boolean | null) => void>(),
      editable = document.createElement("div");
    render(
      <QuestionnaireRichTextEditor
        id="intro"
        label="Introduction"
        value="<p>Saved</p>"
        disabled={false}
        onChange={onChange}
        onValidityChange={validity}
      />,
    );
    act(() => runtime.props?.onReady(engine("<p>Saved</p>", editable)));
    expect(editable).toHaveAttribute("aria-labelledby", "intro-label");
    expect(runtime.props?.config.language.content).toBe("en");
    act(() => runtime.props?.onChange({}, engine("x".repeat(QUESTIONNAIRE_RICH_TEXT_LIMIT + 1))));
    expect(validity).toHaveBeenLastCalledWith(false);
    expect(onChange).not.toHaveBeenCalled();
    act(() => runtime.props?.onChange({}, engine("<p>Shortened</p>")));
    expect(validity).toHaveBeenLastCalledWith(true);
    expect(onChange).toHaveBeenLastCalledWith("<p>Shortened</p>");
  });
  it("uses native Farsi configuration while retaining the parent-owned unsaved document on a flag change", async () => {
    const props = {
      id: "intro",
      label: "Introduction",
      value: "<p>Unsaved <strong>text</strong></p>",
      disabled: false,
      onChange: vi.fn<(html: string | null) => void>(),
      onValidityChange: vi.fn<(valid: boolean | null) => void>(),
    };
    render(<QuestionnaireRichTextEditor {...props} />);
    await act(() => changeProductLanguage("fa"));
    await waitFor(() => expect(runtime.props?.config.language.ui).toBe("fa"));
    expect(runtime.props?.data).toBe(props.value);
    expect(runtime.props?.config.language.content).toBe("en");
    expect(props.onChange).not.toHaveBeenCalled();
  });
});
