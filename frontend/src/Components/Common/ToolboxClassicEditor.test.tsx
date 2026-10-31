import { describe, expect, it, vi } from "vitest";

vi.mock("ckeditor5", () => {
  const plugin = (pluginName: string) =>
    class {
      static readonly pluginName = pluginName;
    };

  return {
    Autoformat: plugin("Autoformat"),
    BlockQuote: plugin("BlockQuote"),
    Bold: plugin("Bold"),
    ClassicEditor: class {},
    Essentials: plugin("Essentials"),
    Heading: plugin("Heading"),
    Image: plugin("Image"),
    ImageCaption: plugin("ImageCaption"),
    ImageStyle: plugin("ImageStyle"),
    ImageToolbar: plugin("ImageToolbar"),
    ImageUpload: plugin("ImageUpload"),
    Indent: plugin("Indent"),
    Italic: plugin("Italic"),
    Link: plugin("Link"),
    List: plugin("List"),
    MediaEmbed: plugin("MediaEmbed"),
    Paragraph: plugin("Paragraph"),
    PasteFromOffice: plugin("PasteFromOffice"),
    Table: plugin("Table"),
    TableToolbar: plugin("TableToolbar"),
    Underline: plugin("Underline"),
  };
});

vi.mock("@ckeditor/ckeditor5-react", () => ({ CKEditor: () => null }));

import { toolboxClassicEditorConfig } from "./ToolboxClassicEditor";

describe("toolbox CKEditor GPL contract", () => {
  it("uses the approved GPL key and the retained classic-editor controls", () => {
    expect(toolboxClassicEditorConfig.licenseKey).toBe("GPL");
    expect(toolboxClassicEditorConfig.toolbar).toEqual([
      "undo",
      "redo",
      "|",
      "heading",
      "|",
      "bold",
      "italic",
      "link",
      "|",
      "bulletedList",
      "numberedList",
      "|",
      "outdent",
      "indent",
      "|",
      "blockQuote",
      "insertTable",
      "mediaEmbed",
    ]);
    expect(toolboxClassicEditorConfig.plugins.map((plugin) => plugin.pluginName)).toEqual(
      expect.arrayContaining(["Essentials", "Heading", "Image", "List", "Table"]),
    );
  });
});
