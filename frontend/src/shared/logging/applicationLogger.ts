const isDevelopmentEnvironment = import.meta.env.DEV;

export const applicationLogger = {
  debug(message: string, details?: unknown): void {
    if (isDevelopmentEnvironment) {
      console.debug(message, details ?? "");
    }
  },
  info(message: string, details?: unknown): void {
    if (isDevelopmentEnvironment) {
      console.info(message, details ?? "");
    }
  },
  warn(message: string, details?: unknown): void {
    if (isDevelopmentEnvironment) {
      console.warn(message, details ?? "");
    }
  },
  error(message: string, details?: unknown): void {
    console.error(message, details ?? "");
  },
};
