const { withAndroidManifest } = require("expo/config-plugins");

/**
 * Config plugin that injects the Google Maps API key into AndroidManifest.xml
 * at prebuild time, reading from EXPO_PUBLIC_GOOGLE_MAPS_API_KEY env var.
 *
 * This keeps the API key OUT of the expoConfig (which is fingerprinted),
 * preventing runtime version mismatches between local and EAS builds
 * when the env var differs.
 */
function withGoogleMapsApiKey(config) {
  return withAndroidManifest(config, (config) => {
    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

    if (!apiKey) {
      console.warn(
        "withGoogleMapsApiKey: EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is not set. Google Maps may not work on Android.",
      );
      return config;
    }

    const manifest = config.modResults;
    const application = manifest.manifest.application?.[0];

    if (!application) {
      console.warn(
        "withGoogleMapsApiKey: Could not find application element in AndroidManifest.xml",
      );
      return config;
    }

    if (!application["meta-data"]) {
      application["meta-data"] = [];
    }

    const metaDataName = "com.google.android.geo.API_KEY";
    const existing = application["meta-data"].find(
      (m) => m.$?.["android:name"] === metaDataName,
    );

    if (existing) {
      existing.$["android:value"] = apiKey;
    } else {
      application["meta-data"].push({
        $: {
          "android:name": metaDataName,
          "android:value": apiKey,
        },
      });
    }

    console.log(
      "withGoogleMapsApiKey: Injected Google Maps API key into AndroidManifest.xml",
    );
    return config;
  });
}

module.exports = withGoogleMapsApiKey;
