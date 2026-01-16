const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Config plugin that adds `use_modular_headers!` to the Podfile
 * This is required for Firebase Swift pods compatibility with static libraries
 */
function withModularHeaders(config) {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile",
      );

      try {
        let contents = fs.readFileSync(podfilePath, "utf8");

        // Check if use_modular_headers! already exists
        if (contents.includes("use_modular_headers!")) {
          console.log("use_modular_headers! already exists in Podfile");
          return config;
        }

        // Add use_modular_headers! before prepare_react_native_project!
        contents = contents.replace(
          "prepare_react_native_project!",
          "# Enable modular headers for Firebase Swift pods compatibility\nuse_modular_headers!\n\nprepare_react_native_project!",
        );

        fs.writeFileSync(podfilePath, contents);
        console.log("Added use_modular_headers! to Podfile");
      } catch (error) {
        console.warn("Could not modify Podfile:", error.message);
      }

      return config;
    },
  ]);
}

module.exports = withModularHeaders;
