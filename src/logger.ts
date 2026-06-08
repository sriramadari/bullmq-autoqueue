import type { Logger } from "./types";

/** Default logger when none is supplied — thin wrapper over `console`. */
export const consoleLogger: Logger = {
  info: (m) => console.log(m),
  error: (m) => console.error(m),
  warn: (m) => console.warn(m),
  debug: (m) => console.debug(m),
};
