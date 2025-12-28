// frontend/src/assets/js/app.ts
// Velzon helpers for SPA/Next (idempotent, safe re-init)

type Root = ParentNode

const $ = <T extends Element = Element>(root: Root, sel: string) =>
  root.querySelector(sel) as T | null
const $$ = <T extends Element = Element>(root: Root, sel: string) =>
  Array.from(root.querySelectorAll(sel)) as T[]

export const on = (
  el: Element | Document | Window | null | undefined,
  ev: string,
  fn: EventListenerOrEventListenerObject,
  opts?: AddEventListenerOptions
) => {
  if (!el) return
  el.addEventListener(ev, fn, opts)
}

// ----------------------------
// Public init (safe for SPA)
// ----------------------------
export function initVelzonApp(root: Root = document) {
  // These can safely run many times (they are idempotent internally)
  applyStoredLayoutAttributes()
  bindResetLayoutButton()

  initPreloader()
  initSidebarScrollbar()
  initVerticalHoverToggle()
  initBackToTop()
  initFullscreen(root)

  initHamburger(root)
  initResponsiveLayout()
  initMenuDropdownAutoAlign(root)

  initLightDark(root)

  initSearch()
  initTooltipsAndPopovers(root)

  initCartDropdown(root)
  initNotifications(root)

  initCounters(root)
}

// ----------------------------
// Features (idempotent)
// ----------------------------

// back-to-top
function initBackToTop() {
  const btn = document.getElementById("back-to-top") as HTMLElement | null
  if (!btn) return

  // bind once
  if ((btn as any).__vz_backtotop_bound) return
  ;(btn as any).__vz_backtotop_bound = true

  const onScroll = () => {
    const show =
      document.documentElement.scrollTop > 100 || document.body.scrollTop > 100
    btn.style.display = show ? "block" : "none"
  }

  on(window, "scroll", onScroll, { passive: true })
  onScroll()

  on(btn, "click", () => {
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  })
}

// fullscreen
function initFullscreen(root: Root) {
  const fsBtn = $<HTMLElement>(root, '[data-toggle="fullscreen"]')
  if (!fsBtn) return

  if ((fsBtn as any).__vz_fullscreen_bound) return
  ;(fsBtn as any).__vz_fullscreen_bound = true

  on(fsBtn, "click", (e) => {
    e.preventDefault()
    document.body.classList.toggle("fullscreen-enable")
    if (document.fullscreenElement) document.exitFullscreen?.()
    else document.documentElement.requestFullscreen?.()
  })

  if (!(document as any).__vz_fullscreenchange_bound) {
    ;(document as any).__vz_fullscreenchange_bound = true
    on(document, "fullscreenchange", () => {
      if (!document.fullscreenElement) {
        document.body.classList.remove("fullscreen-enable")
      }
    })
  }
}

// hamburger (supports both Velzon styles)
export function initHamburger(root: Root) {
  // Prefer your header button id
  const btnById = document.getElementById("topnav-hamburger-icon") as HTMLElement | null
  const hamburgerIcon = $<HTMLElement>(root, ".hamburger-icon")

  const target = btnById ?? hamburgerIcon
  if (!target) return

  if ((target as any).__vz_hamburger_bound) return
  ;(target as any).__vz_hamburger_bound = true

  on(target, "click", () => {
    const layout = document.documentElement.getAttribute("data-layout")
    const w = document.documentElement.clientWidth

    // If template expects simple toggle
    if (!layout) {
      document.body.classList.toggle("vertical-sidebar-enable")
      hamburgerIcon?.classList.toggle("open")
      return
    }

    // Velzon behavior (close to original)
    if (layout === "horizontal") {
      document.body.classList.toggle("menu")
      return
    }

    if (layout === "vertical" || layout === "semibox") {
      if (w <= 767) {
        document.body.classList.toggle("vertical-sidebar-enable")
        document.documentElement.setAttribute("data-sidebar-size", "lg")
      } else {
        const cur = document.documentElement.getAttribute("data-sidebar-size") ?? "lg"
        const next = cur === "lg" ? "sm" : "lg"
        document.documentElement.setAttribute("data-sidebar-size", next)
        sessionStorage.setItem("data-sidebar-size", next)
      }
    }

    if (layout === "twocolumn") {
      document.body.classList.toggle("twocolumn-panel")
    }

    hamburgerIcon?.classList.toggle("open")
  })
}

// Light/Dark
export function initLightDark(root: Root) {
  const html = document.documentElement
  const btn = $<HTMLElement>(root, ".light-dark-mode")
  if (!btn) return

  if ((btn as any).__vz_lightdark_bound) return
  ;(btn as any).__vz_lightdark_bound = true

  // restore
  const saved = sessionStorage.getItem("data-bs-theme")
  if (saved) html.setAttribute("data-bs-theme", saved)

  on(btn, "click", () => {
    const cur = html.getAttribute("data-bs-theme") || "light"
    const next = cur === "dark" ? "light" : "dark"
    html.setAttribute("data-bs-theme", next)
    sessionStorage.setItem("data-bs-theme", next)
    window.dispatchEvent(new Event("resize"))
  })
}

// Search
function bindSearch(inputId: string, dropdownId: string, closeId: string) {
  const input = document.getElementById(inputId) as HTMLInputElement | null
  const dropdown = document.getElementById(dropdownId)
  const closeBtn = document.getElementById(closeId)

  if (!input || !dropdown || !closeBtn) return

  // bind once per input
  if ((input as any).__vz_search_bound) return
  ;(input as any).__vz_search_bound = true

  const sync = () => {
    if (input.value.length > 0) {
      dropdown.classList.add("show")
      closeBtn.classList.remove("d-none")
    } else {
      dropdown.classList.remove("show")
      closeBtn.classList.add("d-none")
    }
  }

  on(input, "focus", sync)
  on(input, "keyup", sync)
  on(closeBtn, "click", () => {
    input.value = ""
    dropdown.classList.remove("show")
    closeBtn.classList.add("d-none")
  })

  // body click: bind once globally per inputId (guard on document)
  const docFlag = `__vz_bodyclick_${inputId}`
  if (!(document as any)[docFlag]) {
    ;(document as any)[docFlag] = true
    on(document.body, "click", (e) => {
      const t = e.target as HTMLElement | null
      if (!t) return
      if (t.getAttribute("id") !== inputId) {
        dropdown.classList.remove("show")
        closeBtn.classList.add("d-none")
      }
    })
  }
}

export function initSearch() {
  bindSearch("search-options", "search-dropdown", "search-close-options")

  // support typo + correct id
  bindSearch(
    "search-options-responsive",
    "search-dropdown-responsive",
    "search-close-options"
  )
  bindSearch(
    "search-options-reponsive",
    "search-dropdown-reponsive",
    "search-close-options"
  )
}

// tooltips/popovers
export function initTooltipsAndPopovers(root: Root = document) {
  const bs = (window as any).bootstrap
  if (!bs) return

  // These constructors tolerate repeated init in most bootstrap builds,
  // but we guard per element to be safe.
  root.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((el) => {
    if ((el as any).__vz_tt) return
    ;(el as any).__vz_tt = true
    try {
      new bs.Tooltip(el)
    } catch {}
  })

  root.querySelectorAll('[data-bs-toggle="popover"]').forEach((el) => {
    if ((el as any).__vz_pop) return
    ;(el as any).__vz_pop = true
    try {
      new bs.Popover(el)
    } catch {}
  })
}

// cart
function parsePrice(html: string) {
  const n = Number(html.replace(/[^\d.]/g, ""))
  return Number.isFinite(n) ? n : 0
}
export function initCartDropdown(root: Root = document) {
  const updateTotal = () => {
    let total = 0
    root.querySelectorAll<HTMLElement>(".cart-item-price").forEach((el) => {
      total += parsePrice(el.innerHTML)
    })
    const totalEl = document.getElementById("cart-item-total")
    if (totalEl) totalEl.innerHTML = total.toFixed(0)
  }

  const updateCounts = () => {
    const items = root.querySelectorAll(".dropdown-item-cart")
    const count = items.length

    root
      .querySelectorAll<HTMLElement>(".cartitem-badge")
      .forEach((b) => (b.innerHTML = String(count)))

    const empty = document.getElementById("empty-cart")
    if (empty) empty.style.display = count === 0 ? "block" : "none"

    const checkout = document.getElementById("checkout-elem")
    if (checkout) checkout.style.display = count === 0 ? "none" : "block"

    updateTotal()
  }

  // bind remove buttons once per button
  root
    .querySelectorAll<HTMLElement>(
      "#page-topbar .dropdown-menu-cart .remove-item-btn"
    )
    .forEach((btn) => {
      if ((btn as any).__vz_cart_rm) return
      ;(btn as any).__vz_cart_rm = true
      on(btn, "click", () => {
        btn.closest(".dropdown-item-cart")?.remove()
        updateCounts()
      })
    })

  updateCounts()
}

// notifications
export function initNotifications(root: Root = document) {
  const actions = document.getElementById("notification-actions")
  const selectCount = document.getElementById("select-content")

  const refresh = () => {
    const checked =
      root.querySelectorAll<HTMLInputElement>(".notification-check input:checked")
        .length
    if (actions) actions.style.display = checked > 0 ? "block" : "none"
    if (selectCount) selectCount.innerHTML = String(checked)
  }

  $$<HTMLInputElement>(root, ".notification-check input").forEach((inp) => {
    if ((inp as any).__vz_notif_bound) return
    ;(inp as any).__vz_notif_bound = true

    on(inp, "change", () => {
      inp.closest(".notification-item")?.classList.toggle("active")
      refresh()
    })
  })

  const dd = document.getElementById("notificationDropdown")
  if (dd && !(dd as any).__vz_ddhide_bound) {
    ;(dd as any).__vz_ddhide_bound = true
    on(dd, "hide.bs.dropdown", () => {
      root
        .querySelectorAll(".notification-item")
        .forEach((i) => i.classList.remove("active"))
      $$<HTMLInputElement>(root, ".notification-check input").forEach(
        (i) => (i.checked = false)
      )
      if (actions) actions.style.display = ""
      refresh()
    })
  }

  const modal = document.getElementById("removeNotificationModal")
  if (modal && !(modal as any).__vz_modal_bound) {
    ;(modal as any).__vz_modal_bound = true
    on(modal, "show.bs.modal", () => {
      const delBtn = document.getElementById("delete-notification")
      if (!delBtn) return
      if ((delBtn as any).__vz_del_bound) return
      ;(delBtn as any).__vz_del_bound = true

      on(delBtn, "click", () => {
        root.querySelectorAll(".notification-item.active").forEach((i) => i.remove())
        refresh()
        ;(document.getElementById("NotificationModalbtn-close") as HTMLElement | null)?.click()
      })
    })
  }

  refresh()
}

// preloader
export function initPreloader() {
  const html = document.documentElement
  const enabled = html.getAttribute("data-preloader") === "enable"
  const pre = document.getElementById("preloader") as HTMLElement | null
  if (!enabled || !pre) return

  if ((pre as any).__vz_preloader_bound) return
  ;(pre as any).__vz_preloader_bound = true

  on(window, "load", () => {
    pre.style.opacity = "0"
    pre.style.visibility = "hidden"
  })
}

// layout attributes + reset
const KEYS = [
  "data-layout",
  "data-sidebar-size",
  "data-bs-theme",
  "data-layout-width",
  "data-sidebar",
  "data-sidebar-image",
  "data-layout-direction",
  "data-layout-position",
  "data-layout-style",
  "data-topbar",
  "data-preloader",
  "data-body-image",
  "data-theme",
  "data-theme-colors",
] as const

export function applyStoredLayoutAttributes() {
  const html = document.documentElement
  KEYS.forEach((k) => {
    const v = sessionStorage.getItem(k)
    if (v) html.setAttribute(k, v)
  })
}

export function bindResetLayoutButton() {
  const btn = document.getElementById("reset-layout")
  if (!btn) return
  if ((btn as any).__vz_reset_bound) return
  ;(btn as any).__vz_reset_bound = true

  on(btn, "click", () => {
    sessionStorage.clear()
    window.location.reload()
  })
}

// responsive layout
export function initResponsiveLayout() {
  // bind once globally
  if ((window as any).__vz_responsive_bound) {
    // still apply once per call to sync with current width
    applyResponsive()
    return
  }
  ;(window as any).__vz_responsive_bound = true

  on(window, "resize", applyResponsive)
  applyResponsive()

  function applyResponsive() {
    const w = document.documentElement.clientWidth
    const html = document.documentElement

    if (w <= 767) {
      document.body.classList.add("vertical-sidebar-enable")
      html.setAttribute("data-sidebar-size", "lg")
      return
    }

    if (w <= 1025) {
      document.body.classList.remove("vertical-sidebar-enable")
      const current = html.getAttribute("data-sidebar-size")
      if (current === "lg") html.setAttribute("data-sidebar-size", "sm")
      return
    }

    document.body.classList.remove("vertical-sidebar-enable")
    const stored = sessionStorage.getItem("data-sidebar-size")
    if (stored) html.setAttribute("data-sidebar-size", stored)
  }
}

// dropdown auto-align
export function initMenuDropdownAutoAlign(root: Root = document) {
  const isFullyVisible = (el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    return (
      r.top >= 0 &&
      r.left >= 0 &&
      r.bottom <= window.innerHeight &&
      r.right <= window.innerWidth
    )
  }

  const handler = (e: Event) => {
    const t = e.target as HTMLElement | null
    if (!t) return

    const handleSub = (sub: HTMLElement | null) => {
      if (!sub) return
      if (!isFullyVisible(sub)) {
        sub.classList.add("dropdown-custom-right")
        sub.closest(".collapse")?.classList.add("dropdown-custom-right")
        sub
          .querySelectorAll<HTMLElement>(".menu-dropdown")
          .forEach((x) => x.classList.add("dropdown-custom-right"))
      } else if (window.innerWidth >= 1848) {
        document
          .querySelectorAll(".dropdown-custom-right")
          .forEach((x) => x.classList.remove("dropdown-custom-right"))
      }
    }

    if (t.matches("a.nav-link span"))
      handleSub(t.parentElement?.nextElementSibling as HTMLElement | null)
    if (t.matches("a.nav-link"))
      handleSub(t.nextElementSibling as HTMLElement | null)
  }

  $$<HTMLElement>(root, "#navbar-nav > li.nav-item").forEach((li) => {
    if ((li as any).__vz_menualign_bound) return
    ;(li as any).__vz_menualign_bound = true
    on(li, "click", handler)
    on(li, "mouseover", handler)
  })
}

// counters
function initCounters(root: Root) {
  const counters = $$<HTMLElement>(root, ".counter-value")
  if (!counters.length) return

  counters.forEach((el) => {
    if ((el as any).__vz_counter_done) return
    ;(el as any).__vz_counter_done = true

    const targetStr = el.getAttribute("data-target")
    if (!targetStr) return

    const target = Number(targetStr)
    if (!Number.isFinite(target)) return

    const duration = 800
    const start = performance.now()
    const from = Number(el.textContent?.replace(/[^\d.-]/g, "")) || 0

    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      const val = Math.round(from + (target - from) * p)
      el.textContent = String(val)
      if (p < 1) requestAnimationFrame(step)
    }

    requestAnimationFrame(step)
  })
}

// vertical hover toggle
function initVerticalHoverToggle() {
  const btn = document.getElementById("vertical-hover") as HTMLElement | null
  if (!btn) return

  if ((btn as any).__vz_vh_bound) return
  ;(btn as any).__vz_vh_bound = true

  on(btn, "click", () => {
    const html = document.documentElement
    const cur = html.getAttribute("data-sidebar-size")

    const next = cur === "sm-hover" ? "sm-hover-active" : "sm-hover"
    html.setAttribute("data-sidebar-size", next)
    sessionStorage.setItem("data-sidebar-size", next)
  })
}

// sidebar scrollbar (SimpleBar)
function initSidebarScrollbar() {
  const el = document.getElementById("scrollbar") as HTMLElement | null
  if (!el) return

  // Ensure attribute exists (unless you intentionally disable it in some layouts)
  if (!el.hasAttribute("data-simplebar")) el.setAttribute("data-simplebar", "")

  // Guard: don't re-init
  if ((el as any).__vz_sb_inited) return
  ;(el as any).__vz_sb_inited = true

  const SimpleBarCtor = (window as any).SimpleBar
  if (!SimpleBarCtor) return

  try {
    ;(el as any).__vz_sb_instance = new SimpleBarCtor(el, { autoHide: false })
  } catch {
    // ignore
  }
}
