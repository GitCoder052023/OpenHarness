export const logger = {
  info(message: string, ...args: unknown[]): void {
    console.log(`[INFO] ${message}`, ...args);
  },
  warn(message: string, ...args: unknown[]): void {
    console.warn(`[WARN] ${message}`, ...args);
  },
  error(message: string, ...args: unknown[]): void {
    console.error(`[ERROR] ${message}`, ...args);
  },
  debug(message: string, ...args: unknown[]): void {
    if (process.env.DEBUG || process.env.NODE_ENV === "development") {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  },
};
