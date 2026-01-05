// Re-export client utilities for convenience
export {
  i18n,
  I18nProvider,
  Trans,
  translateError,
  useTranslation,
} from "./client";

// Re-export server utilities
export { getServerTranslations, getTranslations } from "./server";
