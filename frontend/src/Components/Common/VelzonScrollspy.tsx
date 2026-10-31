import React, { useCallback, useEffect, useState } from "react";

type VelzonScrollspyProps = Omit<React.HTMLAttributes<HTMLUListElement>, "onChange"> & {
  items: readonly string[];
  currentClassName: string;
  offset?: number;
};

const VelzonScrollspy = ({
  children,
  currentClassName,
  items,
  offset = 0,
  ...listProps
}: VelzonScrollspyProps) => {
  const [activeIndex, setActiveIndex] = useState(-1);

  const updateActiveItem = useCallback(() => {
    const targets = items.map((item) => document.getElementById(item));
    const viewportHeight = window.innerHeight;
    const isAtBottom = window.scrollY + viewportHeight >= document.documentElement.scrollHeight;
    let nextActiveIndex = targets.findIndex((target) => {
      if (!target) return false;

      const rectangle = target.getBoundingClientRect();
      const top = rectangle.top + offset;
      return top < viewportHeight && top + target.offsetHeight > 0;
    });

    if (isAtBottom) {
      let lastPresentIndex = -1;
      for (let index = targets.length - 1; index >= 0; index -= 1) {
        if (targets[index]) {
          lastPresentIndex = index;
          break;
        }
      }
      if (lastPresentIndex >= 0) nextActiveIndex = lastPresentIndex;
    }

    setActiveIndex((currentIndex) =>
      currentIndex === nextActiveIndex ? currentIndex : nextActiveIndex,
    );
  }, [items, offset]);

  useEffect(() => {
    let animationFrame = 0;
    const scheduleUpdate = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(updateActiveItem);
    };

    updateActiveItem();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [updateActiveItem]);

  return (
    <ul {...listProps}>
      {React.Children.map(children, (child, index) => {
        if (!React.isValidElement<{ className?: string }>(child)) return child;

        const className = [child.props.className, index === activeIndex && currentClassName]
          .filter(Boolean)
          .join(" ");
        return React.cloneElement(child, { className });
      })}
    </ul>
  );
};

export default VelzonScrollspy;
