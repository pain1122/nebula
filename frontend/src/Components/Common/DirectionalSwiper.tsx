import { forwardRef, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Swiper } from "swiper/react";
import type { SwiperProps, SwiperRef } from "swiper/react";
import type { Swiper as SwiperInstance } from "swiper";

// Swiper reads direction on mount; its native API keeps the same instance on language changes.
const DirectionalSwiper = forwardRef<SwiperRef, SwiperProps>(
  function DirectionalSwiper(props, ref) {
    const { i18n } = useTranslation();
    const direction = i18n.resolvedLanguage === "fa" ? "rtl" : "ltr";
    const [instance, setInstance] = useState<SwiperInstance | null>(null);
    useEffect(() => {
      if (instance && !instance.destroyed) instance.changeLanguageDirection(direction);
    }, [instance, direction]);
    return (
      <Swiper
        {...props}
        ref={ref}
        dir={direction}
        onSwiper={(swiper) => {
          setInstance(swiper);
          props.onSwiper?.(swiper);
        }}
      />
    );
  },
);

export default DirectionalSwiper;
