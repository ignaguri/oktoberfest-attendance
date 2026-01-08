/**
 * Metro shim for `tailwindcss/resolveConfig`.
 *
 * Tailwind v4 no longer exposes this subpath, but some dependencies (e.g. Gluestack utils)
 * still import it to read `theme.screens`.
 *
 * We only return the minimum shape they use.
 */
function resolveConfig(configModule) {
  const config = configModule?.default ?? configModule;
  const theme = config?.theme ?? {};
  const screens = theme?.screens ?? {};

  return {
    ...(config ?? {}),
    theme: {
      ...(theme ?? {}),
      screens,
    },
  };
}

module.exports = resolveConfig;
