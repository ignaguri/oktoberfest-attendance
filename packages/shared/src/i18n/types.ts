import type { TranslationResources } from "./index";

/**
 * Augment i18next types for TypeScript autocomplete
 *
 * This enables autocomplete for translation keys like:
 * t("common.buttons.submit") -> "Submit"
 */
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: {
      translation: TranslationResources;
    };
  }
}
