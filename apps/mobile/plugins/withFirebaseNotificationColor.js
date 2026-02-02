const { withAndroidManifest } = require("expo/config-plugins");

/**
 * Config plugin that adds tools:replace="android:resource" to the Firebase
 * notification color meta-data element to resolve manifest merger conflict
 * with react-native-firebase_messaging.
 */
function withFirebaseNotificationColor(config) {
  return withAndroidManifest(config, async (config) => {
    const manifest = config.modResults;
    const application = manifest.manifest.application?.[0];

    if (!application) {
      console.warn("Could not find application element in AndroidManifest.xml");
      return config;
    }

    // Ensure meta-data array exists
    if (!application["meta-data"]) {
      application["meta-data"] = [];
    }

    const metaDataArray = application["meta-data"];
    const firebaseColorKey =
      "com.google.firebase.messaging.default_notification_color";

    // Find the Firebase notification color meta-data element
    const existingIndex = metaDataArray.findIndex(
      (item) => item.$?.["android:name"] === firebaseColorKey,
    );

    if (existingIndex >= 0) {
      // Add tools:replace to existing element
      metaDataArray[existingIndex].$["tools:replace"] = "android:resource";
      console.log(
        "Added tools:replace to existing Firebase notification color meta-data",
      );
    } else {
      // Add new meta-data element with tools:replace
      metaDataArray.push({
        $: {
          "android:name": firebaseColorKey,
          "android:resource": "@color/notification_icon_color",
          "tools:replace": "android:resource",
        },
      });
      console.log(
        "Added Firebase notification color meta-data with tools:replace",
      );
    }

    return config;
  });
}

module.exports = withFirebaseNotificationColor;
