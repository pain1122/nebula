import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface LegacyFullscreenDocument extends Document {
  mozCancelFullScreen?: () => Promise<void> | void;
  mozFullScreenElement?: Element | null;
  webkitCancelFullScreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
}

interface LegacyFullscreenElement extends HTMLElement {
  mozRequestFullScreen?: () => Promise<void> | void;
  webkitRequestFullscreen?: () => Promise<void> | void;
}

const fullscreenElement = (target: LegacyFullscreenDocument) =>
  target.fullscreenElement ?? target.mozFullScreenElement ?? target.webkitFullscreenElement ?? null;

const FullScreenDropdown: React.FC = () => {
  const { t } = useTranslation();
  const [isFullScreenMode, setIsFullScreenMode] = useState<boolean>(true);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const target = document as LegacyFullscreenDocument;
    const handleFullscreenChange = () => {
      const isFullscreen = Boolean(fullscreenElement(target));
      document.body.classList.toggle("fullscreen-enable", isFullscreen);
      setIsFullScreenMode(!isFullscreen);
    };

    for (const eventName of ["fullscreenchange", "webkitfullscreenchange", "mozfullscreenchange"]) {
      document.addEventListener(eventName, handleFullscreenChange);
    }
    handleFullscreenChange();

    return () => {
      for (const eventName of [
        "fullscreenchange",
        "webkitfullscreenchange",
        "mozfullscreenchange",
      ]) {
        document.removeEventListener(eventName, handleFullscreenChange);
      }
    };
  }, []);

  const toggleFullscreen = () => {
    if (typeof document === "undefined") return;
    const target = document as LegacyFullscreenDocument;
    const root = document.documentElement as LegacyFullscreenElement;

    if (!fullscreenElement(target)) {
      if (root.requestFullscreen) {
        void root.requestFullscreen();
      } else if (root.mozRequestFullScreen) {
        void root.mozRequestFullScreen();
      } else if (root.webkitRequestFullscreen) {
        void root.webkitRequestFullscreen();
      }
    } else {
      if (target.exitFullscreen) {
        void target.exitFullscreen();
      } else if (target.mozCancelFullScreen) {
        void target.mozCancelFullScreen();
      } else if (target.webkitCancelFullScreen) {
        void target.webkitCancelFullScreen();
      }
    }
  };

  return (
    <>
      <div className="ms-1 header-item d-none d-sm-flex">
        <button
          onClick={toggleFullscreen}
          aria-label={
            isFullScreenMode
              ? t("product.shell.enterFullscreen")
              : t("product.shell.exitFullscreen")
          }
          type="button"
          className="btn btn-icon btn-topbar btn-ghost-secondary rounded-circle"
        >
          <i
            className={isFullScreenMode ? "bx bx-fullscreen fs-22" : "bx bx-exit-fullscreen fs-22"}
          ></i>
        </button>
      </div>
    </>
  );
};

export default FullScreenDropdown;
