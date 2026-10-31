import { useContext } from "react";
import type { Context } from "react";
import { useTranslation } from "react-i18next";
import * as Reactstrap from "reactstrap";
import type { DropdownMenuProps } from "reactstrap";

// Reactstrap exposes physical Popper placements; the shell's language owns the logical side.
interface MenuContext {
  readonly direction?: string;
  readonly inNavbar?: boolean;
  readonly [key: string]: unknown;
}
const context = (Reactstrap as unknown as { DropdownContext: Context<MenuContext> })
  .DropdownContext;
const opposite = (direction: string | undefined) =>
  direction === "start"
    ? "end"
    : direction === "end"
      ? "start"
      : direction === "left"
        ? "right"
        : direction === "right"
          ? "left"
          : direction;

export default function DirectionalDropdownMenu(props: DropdownMenuProps) {
  const { i18n } = useTranslation();
  const current = useContext(context);
  const mirror = i18n.resolvedLanguage === "fa" && !current.inNavbar;
  const end = Boolean(props.end ?? props.right ?? false);
  return (
    <context.Provider
      value={{ ...current, direction: mirror ? opposite(current.direction) : current.direction }}
    >
      <Reactstrap.DropdownMenu {...props} end={mirror ? !end : end} right={undefined} />
    </context.Provider>
  );
}
