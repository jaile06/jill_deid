// Base URL of this module's assets/ directory (ends with '/'). Derived from this file's own URL so it
// works under any site sub-path or host without server configuration.
export const assetsBase = new URL('../../', import.meta.url).href;
