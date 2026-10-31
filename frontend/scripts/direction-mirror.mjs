// PostCSS is supplied by the existing Vite toolchain; no dependency is added.
const words = (value) =>
  value.replace(/\b(left|right)\b/gi, (word) => {
    const swapped = word.toLowerCase() === "left" ? "right" : "left";
    return word === word.toUpperCase() ? swapped.toUpperCase() : swapped;
  });
const oppositeSelector = (selector) =>
  words(selector).replace(/\b(prev|next)\b/g, (v) => (v === "prev" ? "next" : "prev"));
const negate = (value) => {
  const v = value.trim();
  if (/^[+-]?0(?:\.[0]+)?(?:[a-z%]+)?$/i.test(v)) return v;
  if (/^-?(?:\d*\.)?\d+(?:[a-z%]+)?$/i.test(v)) return v.startsWith("-") ? v.slice(1) : `-${v}`;
  return `calc(-1 * (${v}))`;
};
const quad = (values) => {
  const [a, b = a, c = a, d = b] = values;
  return [a, d, c, b];
};
const corners = (values) => {
  const [a, b = a, c = a, d = b] = values;
  return [b, a, d, c];
};
const firstCompound = (selector) => {
  let depth = 0,
    quote = "",
    escaped = false;
  for (let i = 0; i < selector.length; i++) {
    const c = selector[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (c === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (c === quote) quote = "";
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      continue;
    }
    if (c === "(" || c === "[") depth++;
    if (c === ")" || c === "]") depth--;
    if (!depth && /[\s>+~]/.test(c)) return i;
  }
  return selector.length;
};
export const scopeDirection = (selector, direction, list) =>
  list
    .comma(selector)
    .flatMap((s) => {
      const prefix = `:where(html[dir="${direction}"])`;
      const descendant = `${prefix} ${s}`;
      if (!/^(?:html\b|:|\[)/.test(s)) return [descendant];
      const end = firstCompound(s);
      return [descendant, `${s.slice(0, end)}${prefix}${s.slice(end)}`];
    })
    .join(", ");

const flipTransforms = (value, list) => {
  const names =
    /\b(translateX|translate|translate3d|rotate|rotateZ|rotateY|skewX|skew|matrix|matrix3d)\(/gi;
  let output = "",
    cursor = 0,
    match;
  while ((match = names.exec(value))) {
    let depth = 1,
      end = names.lastIndex;
    for (; end < value.length && depth; end++) {
      if (value[end] === "(") depth++;
      else if (value[end] === ")") depth--;
    }
    if (depth) throw new Error("Unbalanced CSS transform");
    const name = match[1],
      kind = name.toLowerCase();
    const parts = list.comma(value.slice(names.lastIndex, end - 1));
    if (
      ["translatex", "translate", "translate3d", "rotate", "rotatez", "rotatey", "skewx"].includes(
        kind,
      )
    )
      parts[0] = negate(parts[0]);
    else if (kind === "skew") {
      parts[0] = negate(parts[0]);
      if (parts[1]) parts[1] = negate(parts[1]);
    } else if (kind === "matrix" && parts.length === 6)
      [1, 2, 4].forEach((i) => {
        parts[i] = negate(parts[i]);
      });
    else if (kind === "matrix3d" && parts.length === 16)
      parts.forEach((p, i) => {
        if ((i % 4 === 0) !== (Math.floor(i / 4) === 0)) parts[i] = negate(p);
      });
    output += value.slice(cursor, match.index) + name + "(" + parts.join(", ") + ")";
    cursor = end;
    names.lastIndex = end;
  }
  return output + value.slice(cursor);
};
const flipShadow = (value, list) =>
  list
    .comma(value)
    .map((shadow) => {
      const values = list.space(shadow);
      const first = values.findIndex((v) => /^(?:[+-]?(?:\d|\.\d)|calc\(|var\()/i.test(v));
      if (first >= 0 && !/^var\(/i.test(values[first])) values[first] = negate(values[first]);
      return values.join(" ");
    })
    .join(", ");
const flipPosition = (value, list) =>
  list
    .comma(value)
    .map((position) => {
      const tokens = list.space(position);
      if (/\b(left|right)\b/i.test(position)) return words(position);
      if (tokens[0] && !/^(?:center|top|bottom)$/i.test(tokens[0])) {
        const first = tokens[0];
        tokens[0] = /^-?\d+(?:\.\d+)?%$/.test(first)
          ? `${100 - parseFloat(first)}%`
          : `calc(100% - (${first}))`;
      }
      return tokens.join(" ");
    })
    .join(", ");
const flipGradients = (value) =>
  value
    .replace(
      /(linear-gradient\()([+-]?[\d.]+)(deg|turn|rad)/gi,
      (_all, start, angle, unit) => `${start}${negate(angle)}${unit}`,
    )
    .replace(/\b(left|right)\b/gi, words);
const glyphKey = (value) =>
  value
    .replace(/["']/g, "")
    .replace(/\\0*([a-f0-9]+)/gi, (_s, hex) => String.fromCodePoint(parseInt(hex, 16)));

export function mirrorDeclaration(prop, value, list, glyphs = new Map(), animations = new Set()) {
  const flippedProp =
    /(?:^|-)(left|right)(?:-|$)/i.test(prop) && !prop.startsWith("--") ? words(prop) : prop;
  let flipped = value;
  if (/^(?:margin|padding|border-(?:color|style|width)|inset)$/.test(prop)) {
    const mirrored = quad(list.space(value));
    if (mirrored[1] !== mirrored[3]) flipped = mirrored.join(" ");
  } else if (prop === "border-radius")
    flipped = value
      .split("/")
      .map((v) => corners(list.space(v.trim())).join(" "))
      .join(" / ");
  else if (/^(?:text-align|float|clear|justify-content)$/.test(prop)) flipped = words(value);
  else if (prop === "direction")
    flipped = value === "ltr" ? "rtl" : value === "rtl" ? "ltr" : value;
  else if (prop === "--vz-position")
    flipped = value === "start" ? "end" : value === "end" ? "start" : value;
  else if (
    /^(?:background-position(?:-x)?|object-position|transform-origin|perspective-origin)$/.test(
      prop,
    )
  )
    flipped = flipPosition(value, list);
  else if (/^(?:-(?:webkit|moz|ms|o)-)?transform$/.test(prop))
    flipped = flipTransforms(value, list);
  else if (/shadow$/.test(prop)) flipped = flipShadow(value, list);
  else if (/gradient\(/i.test(value) && !/url\(/i.test(value)) flipped = flipGradients(value);
  else if (prop === "--vz-breadcrumb-divider") flipped = glyphs.get(glyphKey(value)) ?? value;
  if (/^(?:-webkit-)?animation(?:-name)?$/.test(prop))
    for (const name of animations)
      flipped = flipped.replace(
        new RegExp(`(^|[\\s,])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\s|,|$)`, "g"),
        `$1${name}--panel-rtl`,
      );
  return { prop: flippedProp, value: flipped };
}

export default function directionMirror() {
  return {
    postcssPlugin: "checkupino-direction-mirror",
    Once(root, { postcss, result }) {
      // CKEditor ships a complete native directional stylesheet. Preserve its paired
      // language rules and saved-document formats; locale must use its own runtime API.
      if (/node_modules[\\/]ckeditor5[\\/]/.test(root.source?.input.file ?? "")) {
        result.messages.push({
          type: "direction-audit",
          plugin: "checkupino-direction-mirror",
          nativeStylesheet: "ckeditor5",
        });
        return;
      }
      const list = postcss.list,
        ruleValues = new Map(),
        glyphs = new Map(),
        animations = new Set();
      const audit = {
        directionalRules: 0,
        glyphPairs: 0,
        legacyRtlRules: 0,
        nativeRules: 0,
        unsupported: [],
      };
      // Build icon counterparts from the retained fonts, rather than flipping logos/images.
      root.walkRules((rule) => {
        const values = {};
        rule.walkDecls((d) => {
          if (d.prop === "content" || d.prop === "background-image") values[d.prop] = d.value;
        });
        if (Object.keys(values).length) ruleValues.set(rule.selector, values);
      });
      for (const [selector, values] of ruleValues) {
        const opposite = ruleValues.get(oppositeSelector(selector));
        if (opposite && opposite.content && values.content && opposite.content !== values.content) {
          // Breadcrumbs use Material Design Icons; never cross-map codepoints from another font.
          if (selector.startsWith(".mdi-")) glyphs.set(glyphKey(values.content), opposite.content);
          audit.glyphPairs++;
        }
      }
      // RTL-only compensations are superseded by the LTR-derived mirror, never stacked over it.
      root.walkRules((rule) => {
        const selectors = list.comma(rule.selector);
        const retained = selectors.filter((s) => !/\[dir\s*=\s*["']?rtl\b/i.test(s));
        if (retained.length !== selectors.length) audit.legacyRtlRules++;
        if (!retained.length) rule.remove();
        else rule.selector = retained.join(", ");
      });
      root.walkAtRules(/keyframes$/i, (frame) => {
        let changed = false;
        frame.walkDecls((d) => {
          const m = mirrorDeclaration(d.prop, d.value, list, glyphs);
          if (m.prop !== d.prop || m.value !== d.value) changed = true;
        });
        if (changed) animations.add(frame.params);
      });
      const frames = [];
      root.walkAtRules(/keyframes$/i, (frame) => {
        if (animations.has(frame.params)) frames.push(frame);
      });
      for (const frame of frames) {
        const flipped = frame.clone({ params: `${frame.params}--panel-rtl` });
        flipped.walkDecls((d) =>
          Object.assign(d, mirrorDeclaration(d.prop, d.value, list, glyphs)),
        );
        frame.after(flipped);
      }
      const rules = [];
      root.walkRules((rule) => {
        let p = rule.parent;
        while (p && p.type !== "root") {
          if (p.type === "atrule" && /keyframes$/i.test(p.name)) return;
          p = p.parent;
        }
        rules.push(rule);
      });
      for (const rule of rules) {
        // Document formats and runtime-owned directional geometry already have native semantics.
        // Preserve Quill's saved alignment/direction, code readability, and Swiper/FullCalendar
        // physical positioning (their JS reads dir and writes inline transforms/coordinates).
        if (
          /(?:\.ql-editor\b|\.ql-(?:direction|align|indent)-|\.swiper\b|\.swiper-(?!button-(?:prev|next))|\.fc(?:\b|-direction-)|\b(?:pre|code)\b)/.test(
            rule.selector,
          )
        ) {
          audit.nativeRules++;
          continue;
        }
        const rtl = rule.clone();
        let changed = false;
        const paired = ruleValues.get(oppositeSelector(rule.selector));
        rtl.walkDecls((d) => {
          let mirror = mirrorDeclaration(d.prop, d.value, list, glyphs, animations);
          if (d.prop === "content" && paired?.content && paired.content !== d.value)
            mirror = { prop: d.prop, value: paired.content };
          if (d.prop === "content" && /\.breadcrumb-item\b/.test(rule.selector))
            mirror = {
              prop: d.prop,
              value: d.value.replace(/(["'])\\[a-f0-9]+\1/gi, (v) => glyphs.get(glyphKey(v)) ?? v),
            };
          // Encoded carousel arrows have existing opposite artwork; image URLs otherwise remain intact.
          if (
            d.prop === "background-image" &&
            /carousel-control-(?:prev|next)-icon/.test(rule.selector) &&
            paired?.[d.prop]
          )
            mirror = { prop: d.prop, value: paired[d.prop] };
          if (mirror.prop !== d.prop || mirror.value !== d.value) changed = true;
          Object.assign(d, mirror);
          if (/^(?:clip|clip-path|shape-outside)$/.test(d.prop))
            audit.unsupported.push({ selector: rule.selector, property: d.prop });
        });
        if (!changed) continue;
        const baseline = rule.selector.replace(/\[dir\s*=\s*["']?ltr["']?\]/gi, "").trim();
        rule.selector = scopeDirection(baseline || "html", "ltr", list);
        rtl.selector = scopeDirection(baseline || "html", "rtl", list);
        rule.after(rtl);
        audit.directionalRules++;
      }
      result.messages.push({
        type: "direction-audit",
        plugin: "checkupino-direction-mirror",
        ...audit,
      });
    },
  };
}
