import { useState, useMemo, useRef, type ComponentProps } from "react";
import { CKEditor } from "@ckeditor/ckeditor5-react";
import {
  Autoformat,
  BlockQuote,
  Bold,
  ClassicEditor,
  Essentials,
  Heading,
  Image,
  ImageCaption,
  ImageStyle,
  ImageToolbar,
  ImageUpload,
  Indent,
  Italic,
  Link,
  List,
  MediaEmbed,
  Paragraph,
  PasteFromOffice,
  Table,
  TableToolbar,
  Underline,
  type EditorConfig,
  Plugin,
  ButtonView,
} from "ckeditor5";
import persian from "ckeditor5/translations/fa.js";

import "ckeditor5/ckeditor5.css";
export type { ClassicEditor, ClipboardPipeline } from "ckeditor5";

export const toolboxClassicEditorConfig = {
  image: {
    toolbar: [
      "imageTextAlternative",
      "toggleImageCaption",
      "imageStyle:inline",
      "imageStyle:block",
      "imageStyle:side",
    ],
  },
  licenseKey: "GPL",
  plugins: [
    Autoformat,
    BlockQuote,
    Bold,
    Essentials,
    Heading,
    Image,
    ImageCaption,
    ImageStyle,
    ImageToolbar,
    ImageUpload,
    Indent,
    Italic,
    Link,
    List,
    MediaEmbed,
    Paragraph,
    PasteFromOffice,
    Table,
    TableToolbar,
  ],
  table: {
    contentToolbar: ["tableColumn", "tableRow", "mergeTableCells"],
  },
  toolbar: [
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
  ],
} satisfies EditorConfig;

type ToolboxClassicEditorProps = Pick<
  ComponentProps<typeof CKEditor>,
  "data" | "onChange" | "onReady"
>;

const ToolboxClassicEditor = (props: ToolboxClassicEditorProps) => (
  <CKEditor editor={ClassicEditor} config={toolboxClassicEditorConfig} {...props} />
);

export default ToolboxClassicEditor;

export const questionnaireEditorConfig = (
  locale: "en" | "fa",
  contentLocale: "en" | "fa" = locale,
): EditorConfig => ({
  licenseKey: "GPL",
  plugins: [Essentials, Paragraph, Heading, Bold, Italic, Underline, List, BlockQuote, Link],
  toolbar: [
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
  ],
  heading: {
    options: [
      { model: "paragraph", title: "Paragraph", class: "ck-heading_paragraph" },
      { model: "heading1", view: "h2", title: "Heading 1", class: "ck-heading_heading1" },
      { model: "heading2", view: "h3", title: "Heading 2", class: "ck-heading_heading2" },
      { model: "heading3", view: "h4", title: "Heading 3", class: "ck-heading_heading3" },
    ],
  },
  language: { ui: locale, content: contentLocale },
  translations: locale === "fa" ? [persian] : undefined,
  link: { defaultProtocol: "https://", allowedProtocols: ["http", "https", "mailto", "tel"] },
});

type QuestionnaireClassicEditorProps = Pick<
  ComponentProps<typeof CKEditor>,
  "data" | "onChange" | "onReady" | "onError" | "disabled"
> & { readonly locale: "en" | "fa"; readonly contentLocale?: "en" | "fa" };
export function QuestionnaireClassicEditor({
  locale,
  contentLocale: selectedLocale,
  ...props
}: QuestionnaireClassicEditorProps) {
  // Native document language is independent of the flag-owned UI direction.
  const [contentLocale] = useState(() => {
    const template = document.createElement("template");
    template.innerHTML = props.data ?? "";
    const firstLetter = template.content.textContent?.match(/\p{Letter}/u)?.[0];
    return firstLetter ? (/[\u0590-\u08ff]/u.test(firstLetter) ? "fa" : "en") : locale;
  });
  return (
    <CKEditor
      editor={ClassicEditor}
      config={questionnaireEditorConfig(locale, selectedLocale ?? contentLocale)}
      disableWatchdog
      {...props}
    />
  );
}

export function ArticleClassicEditor({
  locale,
  contentLocale,
  onBrowse,
  ...props
}: QuestionnaireClassicEditorProps & { readonly onBrowse: (editor: ClassicEditor) => void }) {
  const browse = useRef(onBrowse);
  browse.current = onBrowse;
  const config = useMemo<EditorConfig>(() => {
    class ArticleFileManager extends Plugin {
      init() {
        this.editor.ui.componentFactory.add("articleFileManager", (uiLocale) => {
          const button = new ButtonView(uiLocale);
          button.set({
            label: locale === "fa" ? "مدیریت فایل" : "File Manager",
            withText: true,
            tooltip: true,
          });
          button.on("execute", () => browse.current(this.editor as ClassicEditor));
          return button;
        });
      }
    }
    return {
      ...questionnaireEditorConfig(locale, contentLocale),
      plugins: [
        Essentials,
        Paragraph,
        Heading,
        Bold,
        Italic,
        Underline,
        List,
        BlockQuote,
        Link,
        Image,
        ImageCaption,
        ImageStyle,
        ImageToolbar,
        ArticleFileManager,
      ],
      image: {
        toolbar: [
          "imageTextAlternative",
          "toggleImageCaption",
          "imageStyle:inline",
          "imageStyle:block",
          "imageStyle:side",
        ],
      },
      toolbar: [
        "articleFileManager",
        "|",
        ...(questionnaireEditorConfig(locale).toolbar as string[]),
      ],
    };
  }, [locale, contentLocale]);
  return <CKEditor editor={ClassicEditor} config={config} disableWatchdog {...props} />;
}
