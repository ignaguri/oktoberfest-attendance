/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: "widget",
  name: "ProstCounterLiveActivity",
  bundleIdentifier: ".liveactivity",
  deploymentTarget: "17.0",
  entitlements: {
    "com.apple.security.application-groups": ["group.com.prostcounter.shared"],
  },
};
