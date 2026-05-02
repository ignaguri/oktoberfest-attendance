const { withGradleProperties } = require("@expo/config-plugins");

const JVM_ARGS_KEY = "org.gradle.jvmargs";
const HEAP_FLAG = "-Xmx4096m";
const METASPACE_FLAG = "-XX:MaxMetaspaceSize=2048m";

/**
 * Merge heap (-Xmx) and metaspace (-XX:MaxMetaspaceSize) flags into the
 * existing jvmargs string, replacing any prior values for those two flags
 * while preserving every other arg (e.g. -Dfile.encoding=UTF-8 or Kotlin
 * daemon options the Expo template may add later).
 */
const mergeJvmArgs = (existing) => {
  const tokens = (existing || "").split(/\s+/).filter(Boolean);
  const preserved = tokens.filter(
    (t) => !t.startsWith("-Xmx") && !t.startsWith("-XX:MaxMetaspaceSize"),
  );
  return [...preserved, HEAP_FLAG, METASPACE_FLAG].join(" ");
};

const withAndroidGradleJvmArgs = (config) =>
  withGradleProperties(config, (cfg) => {
    const props = cfg.modResults;
    const existing = props.find((p) => p.type === "property" && p.key === JVM_ARGS_KEY);
    const merged = mergeJvmArgs(existing?.value);

    if (existing) {
      existing.value = merged;
    } else {
      props.push({ type: "property", key: JVM_ARGS_KEY, value: merged });
    }

    console.log(`withAndroidGradleJvmArgs: set ${JVM_ARGS_KEY}=${merged}`);
    return cfg;
  });

module.exports = withAndroidGradleJvmArgs;
