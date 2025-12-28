
import Toastify from "toastify-js";
import "toastify-js/src/toastify.css";

import Choices from "choices.js";
import "choices.js/public/assets/styles/choices.min.css";

import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.min.css";

// جایگزین layout.js  :contentReference[oaicite:3]{index=3}
export function applySavedHtmlAttributes() {
  const raw = sessionStorage.getItem("defaultAttribute");
  if (!raw) return;

  try {
    const attrs = JSON.parse(raw) as Record<string, string>;
    Object.entries(attrs).forEach(([k, v]) => {
      if (v != null) document.documentElement.setAttribute(k, v);
    });
  } catch {
    // اگر خراب بود پاکش می‌کنیم
    sessionStorage.removeItem("defaultAttribute");
  }
}

// جایگزین plugins.js (بدون document.writeln) :contentReference[oaicite:4]{index=4}
export function initPlugins(root: ParentNode = document) {
  // Toast buttons: [data-toast-*]
  root.querySelectorAll<HTMLElement>("[data-toast]").forEach((el) => {
    el.addEventListener("click", () => {
      const get = (name: string) => el.getAttribute(name) ?? "";
      Toastify({
        text: get("data-toast-text") || "OK",
        gravity: (get("data-toast-gravity") as any) || "top",
        position: (get("data-toast-position") as any) || "right",
        duration: Number(get("data-toast-duration") || 3000),
        close: get("data-toast-close") === "close",
      }).showToast();
    });
  });

  // Choices: [data-choices]
  root.querySelectorAll<HTMLSelectElement | HTMLInputElement>("[data-choices]").forEach((el) => {
    // جلوگیری از init دوباره
    if ((el as any).__choices) return;

    const searchEnabled = el.hasAttribute("data-choices-search-true")
      ? true
      : el.hasAttribute("data-choices-search-false")
        ? false
        : undefined;

    const instance = new Choices(el as any, {
      searchEnabled,
      removeItemButton: el.hasAttribute("data-choices-removeItem") || el.hasAttribute("data-choices-multiple-remove"),
      shouldSort: el.hasAttribute("data-choices-sorting-false") ? false : undefined,
    });

    (el as any).__choices = instance;
  });

  // Flatpickr: [data-provider="flatpickr"]
  root.querySelectorAll<HTMLElement>('[data-provider="flatpickr"]').forEach((el) => {
    if ((el as any).__flatpickr) return;

    const dateFormat = el.getAttribute("data-date-format") ?? "Y-m-d";
    const enableTime = el.hasAttribute("data-enable-time");

    const instance = flatpickr(el as any, {
      dateFormat: enableTime ? `${dateFormat} H:i` : dateFormat,
      enableTime,
      disableMobile: true,
    });

    (el as any).__flatpickr = instance;
  });
}

/**
 * «حداقلِ React-friendly» برای جایگزینی app.js
 * (فقط چیزهایی که معمولاً باعث crash می‌شوند را safe می‌کنیم)
 */
export function initVelzonBasics() {
  // back-to-top (ته app.js هست) :contentReference[oaicite:5]{index=5}
  const mybutton = document.getElementById("back-to-top");
  if (mybutton) {
    const onScroll = () => {
      const show = document.body.scrollTop > 100 || document.documentElement.scrollTop > 100;
      (mybutton as HTMLElement).style.display = show ? "block" : "none";
    };
    window.addEventListener("scroll", onScroll);
    onScroll();

    mybutton.addEventListener("click", () => {
      document.body.scrollTop = 0;
      document.documentElement.scrollTop = 0;
    });
  }

  // fullscreen toggle اگر وجود داشت
  const fsBtn = document.querySelector<HTMLElement>('[data-toggle="fullscreen"]');
  if (fsBtn) {
    fsBtn.addEventListener("click", (e) => {
      e.preventDefault();
      document.body.classList.toggle("fullscreen-enable");
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen?.();
    });
  }
}
