import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

import type { ProductLocale } from "../preferences/localization";

type OverlayVariant = "dialog" | "drawer";

interface OverlayCopy {
  readonly close: string;
}

const overlayCopy: Readonly<Record<ProductLocale, OverlayCopy>> = {
  en: { close: "Close" },
  fa: { close: "بستن" },
};

const focusableSelector = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

const focusableElements = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>(focusableSelector)].filter(
    (element) => !element.hasAttribute("hidden") && element.getAttribute("aria-hidden") !== "true",
  );

export interface OverlayProps {
  readonly busy?: boolean;
  readonly children: ReactNode;
  readonly closeLabel?: string;
  readonly description?: ReactNode;
  readonly footer?: ReactNode;
  readonly initialFocusRef?: RefObject<HTMLElement>;
  readonly locale?: ProductLocale;
  readonly onClose: () => void;
  readonly open: boolean;
  readonly title: ReactNode;
  readonly size?: "lg";
}

interface OverlaySurfaceProps extends OverlayProps {
  readonly variant: OverlayVariant;
}

const OverlaySurface = ({
  busy = false,
  children,
  closeLabel,
  description,
  footer,
  initialFocusRef,
  locale = "fa",
  onClose,
  open,
  title,
  size,
  variant,
}: OverlaySurfaceProps) => {
  const generatedId = useId();
  const titleId = `${generatedId}-title`;
  const descriptionId = description ? `${generatedId}-description` : undefined;
  const panelRef = useRef<HTMLDialogElement>(null);
  const fallbackInitialFocus = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return undefined;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const panel = panelRef.current;
    const target = initialFocusRef?.current ?? fallbackInitialFocus.current ?? panel ?? undefined;
    target?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [initialFocusRef, open]);

  if (!open) return null;

  const handleKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (!busy) onClose();
      return;
    }
    if (event.key !== "Tab" || !panelRef.current) return;

    const focusable = focusableElements(panelRef.current);
    if (focusable.length === 0) {
      event.preventDefault();
      panelRef.current.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const copy = overlayCopy[locale];
  const closeText = closeLabel ?? copy.close;
  const isDrawer = variant === "drawer";

  return createPortal(
    <div data-overlay={variant}>
      <button
        aria-label={closeText}
        className="modal-backdrop fade show border-0"
        disabled={busy}
        onClick={onClose}
        tabIndex={-1}
        type="button"
      />
      <dialog
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className={isDrawer ? "offcanvas show" : "modal d-block"}
        onKeyDown={handleKeyDown}
        open
        ref={panelRef}
        style={
          isDrawer
            ? {
                insetInlineEnd: 0,
                insetInlineStart: "auto",
                visibility: "visible",
                zIndex: 1055,
              }
            : {
                background: "transparent",
                border: 0,
                margin: 0,
                maxHeight: "none",
                maxWidth: "none",
                padding: 0,
              }
        }
        tabIndex={-1}
      >
        {isDrawer ? (
          <>
            <div className="offcanvas-header">
              <h2 className="offcanvas-title h5" id={titleId}>
                {title}
              </h2>
              <button
                aria-label={closeText}
                className="btn-close"
                disabled={busy}
                onClick={onClose}
                ref={fallbackInitialFocus}
                type="button"
              />
            </div>
            <div className="offcanvas-body">
              {description ? (
                <p className="text-muted" id={descriptionId}>
                  {description}
                </p>
              ) : null}
              {children}
            </div>
            {footer ? <div className="border-top p-3">{footer}</div> : null}
          </>
        ) : (
          <div
            className={"modal-dialog modal-dialog-centered" + (size === "lg" ? " modal-lg" : "")}
            role="document"
          >
            <div className="modal-content">
              <div className="modal-header">
                <h2 className="modal-title h5" id={titleId}>
                  {title}
                </h2>
                <button
                  aria-label={closeText}
                  className="btn-close"
                  disabled={busy}
                  onClick={onClose}
                  ref={fallbackInitialFocus}
                  type="button"
                />
              </div>
              <div className="modal-body">
                {description ? (
                  <p className="text-muted" id={descriptionId}>
                    {description}
                  </p>
                ) : null}
                {children}
              </div>
              {footer ? <div className="modal-footer">{footer}</div> : null}
            </div>
          </div>
        )}
      </dialog>
    </div>,
    document.body,
  );
};

export const Dialog = (props: OverlayProps) => <OverlaySurface {...props} variant="dialog" />;
export const Drawer = (props: OverlayProps) => <OverlaySurface {...props} variant="drawer" />;
