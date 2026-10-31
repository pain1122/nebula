import type { ReactNode } from "react";

/** The original Velzon three-pane frame, shared by the full page and embedded library. */
export default function FileManagerFrame({
  sidebar,
  content,
  details,
  embedded = false,
  sidebarOpen = false,
}: {
  readonly sidebar: ReactNode;
  readonly content: ReactNode;
  readonly details: ReactNode;
  readonly embedded?: boolean;
  readonly sidebarOpen?: boolean;
}) {
  return (
    <div
      className={
        "chat-wrapper d-lg-flex gap-1 p-1" + (embedded ? " file-manager-embedded" : " mx-n4 mt-n4")
      }
      data-velzon-file-manager={embedded ? "embedded" : "page"}
      data-sidebar-open={sidebarOpen}
    >
      <div className="file-manager-sidebar">{sidebar}</div>
      <div className="file-manager-content w-100 p-3 py-0">{content}</div>
      <div className="file-manager-detail-content p-3 py-0">{details}</div>
    </div>
  );
}
