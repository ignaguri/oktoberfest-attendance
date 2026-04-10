const { withEntitlementsPlist } = require("expo/config-plugins");

/**
 * Forces aps-environment to "production" in the iOS entitlements.
 *
 * Why: bare workflow ships ios/ProstCounter/ProstCounter.entitlements as-is.
 * Without this, Debug builds leave aps-environment = "development" and any
 * App Store / TestFlight build gets a sandbox APNs token, so Expo Push
 * silently fails to deliver. "production" works for both App Store and dev
 * client builds that have the Push Notifications capability enabled.
 */
function withApsEnvironment(config) {
  return withEntitlementsPlist(config, (config) => {
    config.modResults["aps-environment"] = "production";
    return config;
  });
}

module.exports = withApsEnvironment;
