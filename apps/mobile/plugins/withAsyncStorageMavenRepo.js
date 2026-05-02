const { withProjectBuildGradle } = require("expo/config-plugins");

/**
 * Config plugin that adds the async-storage local Maven repository to the
 * project-level build.gradle. Required for @react-native-async-storage/async-storage v3+
 * which ships org.asyncstorage.shared_storage:storage-android as a local artifact.
 */
function withAsyncStorageMavenRepo(config) {
  return withProjectBuildGradle(config, (config) => {
    const buildGradle = config.modResults.contents;

    if (buildGradle.includes("react-native-async-storage_async-storage")) {
      return config;
    }

    const mavenLine = `    maven { url = uri(project(":react-native-async-storage_async-storage").file("local_repo")) }`;

    // Insert the maven repo line right before the jitpack line or as a new entry
    // in allprojects > repositories
    const jitpackPattern = /(\s*maven\s*\{\s*url\s*'https:\/\/www\.jitpack\.io'\s*\})/;
    if (jitpackPattern.test(buildGradle)) {
      config.modResults.contents = buildGradle.replace(jitpackPattern, `$1\n${mavenLine}`);
    } else {
      // Fallback: insert before the closing brace of allprojects > repositories
      config.modResults.contents = buildGradle.replace(
        /(allprojects\s*\{\s*\n\s*repositories\s*\{[^}]*)(})/,
        `$1${mavenLine}\n  $2`,
      );
    }

    console.log(
      "withAsyncStorageMavenRepo: Added async-storage local Maven repository to build.gradle",
    );
    return config;
  });
}

module.exports = withAsyncStorageMavenRepo;
