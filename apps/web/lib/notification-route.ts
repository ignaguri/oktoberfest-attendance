const GROUP_SETTINGS_ROUTE = /^\/group-detail\/([^/?#]+)\/settings(?=[?#]|$)/;
const GROUP_DETAIL_ROUTE = /^\/group-detail\/([^/?#]+)(?=[/?#]|$)/;

/**
 * Notification routes are shared with mobile, where a group lives at
 * /group-detail/{id}. Web has no such page: the group is /groups/{id} and its
 * settings are /group-settings/{id}. Every other shared route exists on web
 * as-is.
 *
 * Sub-pages (messages, gallery, calendar, location) sit under the group on
 * both platforms, so the detail rewrite keeps whatever follows the id instead
 * of only matching the bare route. Settings is the one that moves elsewhere,
 * which is why it is rewritten first.
 */
export function toWebRoute(route: string): string {
  return route
    .replace(GROUP_SETTINGS_ROUTE, "/group-settings/$1")
    .replace(GROUP_DETAIL_ROUTE, "/groups/$1");
}
