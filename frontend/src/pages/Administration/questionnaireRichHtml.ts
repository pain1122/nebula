// Presentation allowlist matches QuestionnaireRichTextSanitizer; the server remains authoritative.
const allowed = new Set([
  "p",
  "br",
  "strong",
  "em",
  "b",
  "i",
  "u",
  "ul",
  "ol",
  "li",
  "blockquote",
  "h2",
  "h3",
  "h4",
  "a",
]);
const blocked = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "svg",
  "math",
  "template",
  "form",
  "input",
  "textarea",
  "select",
  "button",
  "img",
  "video",
  "audio",
  "canvas",
  "link",
  "meta",
  "base",
  "noscript",
]);
export const QUESTIONNAIRE_RICH_TEXT_LIMIT = 20000;
export function questionnaireRichHtml(html: string | null): string {
  if (!html) return "";
  if (html.length > QUESTIONNAIRE_RICH_TEXT_LIMIT)
    throw new RangeError("Rich text exceeds its bound.");
  // Template content is inert. Raw input never enters the active document/editor.
  const source = document.createElement("template"),
    output = document.createElement("template");
  source.innerHTML = html;
  const copy = (node: Node, parent: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      parent.appendChild(document.createTextNode(node.textContent ?? ""));
      return;
    }
    if (!(node instanceof Element)) return;
    const tag = node.localName.toLowerCase();
    if (blocked.has(tag)) return;
    if (!allowed.has(tag)) {
      node.childNodes.forEach((child) => copy(child, parent));
      return;
    }
    const clean = document.createElement(tag);
    if (tag === "a") {
      const href = node.getAttribute("href");
      if (href) {
        try {
          const url = new URL(href);
          if (["http:", "https:", "mailto:", "tel:"].includes(url.protocol))
            clean.setAttribute("href", href);
        } catch {
          /* Relative/invalid links remain text. */
        }
      }
      const title = node.getAttribute("title");
      if (title) clean.setAttribute("title", title);
    }
    node.childNodes.forEach((child) => copy(child, clean));
    parent.appendChild(clean);
  };
  source.content.childNodes.forEach((node) => copy(node, output.content));
  const result = output.innerHTML;
  if (result.length > QUESTIONNAIRE_RICH_TEXT_LIMIT)
    throw new RangeError("Rich text exceeds its bound.");
  return result;
}
