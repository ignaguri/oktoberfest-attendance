const { withGradleProperties } = require("@expo/config-plugins");

const JVM_ARGS_KEY = "org.gradle.jvmargs";
const JVM_ARGS_VALUE = "-Xmx4096m -XX:MaxMetaspaceSize=2048m";

const withAndroidGradleJvmArgs = (config) =>
  withGradleProperties(config, (cfg) => {
    const props = cfg.modResults;
    const existing = props.find(
      (p) => p.type === "property" && p.key === JVM_ARGS_KEY,
    );

    if (existing) {
      existing.value = JVM_ARGS_VALUE;
    } else {
      props.push({
        type: "property",
        key: JVM_ARGS_KEY,
        value: JVM_ARGS_VALUE,
      });
    }

    console.log(
      `withAndroidGradleJvmArgs: set ${JVM_ARGS_KEY}=${JVM_ARGS_VALUE}`,
    );
    return cfg;
  });

module.exports = withAndroidGradleJvmArgs;
