import { useEffect, useState } from "react";

export const CascadingEffect = () => {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    setOpen(false);
  }, []);

  return open ? <span>Open</span> : null;
};
