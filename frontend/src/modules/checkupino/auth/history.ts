// A restored document can retain its old authority and query cache after another
// document logs out. Keep its app tree hidden and restart through session bootstrap.
export const installSessionHistoryGuard = (
  target: Window = window,
  getRoot: () => HTMLElement | null = () => document.getElementById("root"),
  reload: () => void = () => window.location.reload(),
) => {
  const hide = () => {
    const root = getRoot();
    if (root) root.hidden = true;
  };
  const onHide = (event: PageTransitionEvent) => {
    if (event.persisted) hide();
  };
  const onShow = (event: PageTransitionEvent) => {
    if (!event.persisted) return;
    hide();
    reload();
  };
  target.addEventListener("pagehide", onHide);
  target.addEventListener("pageshow", onShow);
  return () => {
    target.removeEventListener("pagehide", onHide);
    target.removeEventListener("pageshow", onShow);
  };
};
