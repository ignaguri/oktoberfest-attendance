module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      "babel-preset-expo",
      // Note: NativeWind v5 does NOT use nativewind/babel - it was removed in v5
    ],
    plugins: [
      "react-native-reanimated/plugin", // Must be last
    ],
  };
};
