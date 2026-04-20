/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: "watch",
  name: "ProstCounter Watch",
  bundleIdentifier: "com.prostcounter.app.watchkitapp",
  icon: "../../assets/images/logo.png",
  deploymentTarget: "10.0",
  entitlements: {
    "com.apple.security.application-groups": ["group.com.prostcounter.shared"],
  },
};
