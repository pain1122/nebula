export const DEV_TOOLBOX_BASE_PATH = "/dev";
export const DEV_TOOLBOX_DEFAULT_PATH = `${DEV_TOOLBOX_BASE_PATH}/dashboard-analytics`;
export const DEV_TOOLBOX_COMPATIBILITY_ALIASES = [`${DEV_TOOLBOX_BASE_PATH}/index`] as const;

export const toDevToolboxPath = (path: string) =>
  `${DEV_TOOLBOX_BASE_PATH}${path === "/" ? "" : path}`;

export const fromLegacyDevToolboxPath = (path: string | undefined) => {
  if (!path) return path;
  if (path === "/panel/dev") return DEV_TOOLBOX_BASE_PATH;
  return path.startsWith("/panel/dev/") ? path.slice("/panel".length) : path;
};
