import { initI18n, i18n } from "@prostcounter/shared/i18n/core";

// Initialize i18n for server
initI18n();

/**
 * Get translation function for server components
 *
 * @example
 * ```tsx
 * export default async function Page() {
 *   const t = getTranslations();
 *   return <h1>{t('groups.pageTitle')}</h1>;
 * }
 * ```
 */
export function getTranslations() {
  return i18n.getFixedT("en");
}

/**
 * Get translation function for generateMetadata
 *
 * @example
 * ```tsx
 * export async function generateMetadata() {
 *   const t = await getServerTranslations();
 *   return { title: t('groups.pageTitle') };
 * }
 * ```
 */
export async function getServerTranslations() {
  return i18n.getFixedT("en");
}
