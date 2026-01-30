// URL utilities
export { getAppUrl, replaceLocalhostInUrl } from "./url";

// Date utilities
export {
  formatDateForDatabase,
  formatTimestampForDatabase,
  formatRelativeTime,
  getDateLocale,
  formatLocalized,
} from "./date-utils";

// Image URL utilities
export {
  createGetAvatarUrl,
  createGetBeerPictureUrl,
  type ImageUrlStrategy,
  type ImageUrlConfig,
} from "./image-urls";
