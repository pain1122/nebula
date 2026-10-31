import { imageIdFromUrl, imagePath, imageUrl } from "../../../modules/checkupino/content/media";
const allowedTags = new Set([
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
  "figure",
  "figcaption",
  "img",
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
  "video",
  "audio",
  "canvas",
  "link",
  "meta",
  "base",
  "noscript",
]);

// Inert parsing first. Only manifest-owned, authenticated editorial image URLs enter the editor.
export function articleRichHtml(html: string, allowed: readonly string[], display = false): string {
  if (html.length > 20000) throw new RangeError("Article body exceeds its bound.");
  const source = document.createElement("template"),
    output = document.createElement("template");
  source.innerHTML = html;
  const copy = (node: Node, parent: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      parent.appendChild(document.createTextNode(node.textContent ?? ""));
      return;
    }
    if (!(node instanceof Element)) return;
    const tag = node.localName;
    if (blocked.has(tag)) return;
    if (!allowedTags.has(tag)) {
      node.childNodes.forEach((child) => copy(child, parent));
      return;
    }
    const clean = document.createElement(tag);
    if (tag === "img") {
      const id = imageIdFromUrl(node.getAttribute("src") ?? "");
      if (!id || !allowed.includes(id)) return;
      clean.setAttribute("src", display ? imageUrl(id) : imagePath(id));
      clean.setAttribute(
        "alt",
        (node.getAttribute("alt") ?? "").replace(/[\x00-\x1f\x7f]/g, "").slice(0, 255),
      );
    }
    if (tag === "figure") clean.setAttribute("class", "image");
    if (tag === "a") {
      try {
        const href = node.getAttribute("href") ?? "",
          url = new URL(href);
        if (["http:", "https:", "mailto:", "tel:"].includes(url.protocol))
          clean.setAttribute("href", href);
      } catch {
        /* Invalid links remain text. */
      }
      if (node.hasAttribute("title")) clean.setAttribute("title", node.getAttribute("title") ?? "");
    }
    node.childNodes.forEach((child) => copy(child, clean));
    parent.appendChild(clean);
  };
  source.content.childNodes.forEach((node) => copy(node, output.content));
  const result = output.innerHTML;
  if (result.length > 20000) throw new RangeError("Article body exceeds its bound.");
  return result;
}
export function articleImageIds(html: string): string[] {
  const source = document.createElement("template");
  source.innerHTML = html;
  return [
    ...new Set(
      [...source.content.querySelectorAll("img")]
        .map((image) => imageIdFromUrl(image.getAttribute("src") ?? ""))
        .filter((id): id is string => id !== null),
    ),
  ];
}
