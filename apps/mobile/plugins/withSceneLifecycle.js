const { withDangerousMod, withInfoPlist } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Config plugin that moves the iOS app onto the UIScene life cycle.
 *
 * Why: apps linked against the iOS 27 SDK (Xcode 27) are killed at launch on
 * iOS 27 unless they adopt scenes. The crash is an EXC_BREAKPOINT in
 * _UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption, before any JS
 * or Sentry runs. 1.10.2 build 99 shipped to TestFlight like that.
 *
 * Expo 57 ships the scene delegate (ExpoAppSceneDelegate, ObjC name
 * EXExpoAppSceneDelegate) but its bare template still starts React Native from
 * the app delegate, so this plugin wires it up:
 *
 * 1. Info.plist: a UIApplicationSceneManifest whose single window scene uses
 *    EXExpoAppSceneDelegate. It creates the UIWindow, starts React Native and
 *    forwards URLs, user activities and quick actions to the app delegate, so
 *    the existing RCTLinkingManager overrides keep working.
 * 2. AppDelegate.swift: conform to ExpoReactNativeFactoryProvider (the scene
 *    delegate reads the factory and window through it) and drop the window
 *    creation + startReactNative call, which the scene delegate now owns.
 */

const SCENE_MANIFEST = {
  UIApplicationSupportsMultipleScenes: false,
  UISceneConfigurations: {
    UIWindowSceneSessionRoleApplication: [
      {
        UISceneConfigurationName: "Default Configuration",
        UISceneDelegateClassName: "EXExpoAppSceneDelegate",
      },
    ],
  },
};

const CLASS_DECLARATION = "class AppDelegate: ExpoAppDelegate {";
const CLASS_DECLARATION_WITH_PROVIDER =
  "class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {";

// Whitespace must match the Expo-generated template exactly.
const START_REACT_NATIVE_BLOCK = `#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif
`;

const START_REACT_NATIVE_REPLACEMENT = `    // React Native starts in ExpoAppSceneDelegate once the window scene connects
    // (injected by withSceneLifecycle.js; required by the iOS 27 SDK).
`;

function replaceExactlyOnce(src, search, replacement, label) {
  const matches = src.split(search).length - 1;
  if (matches !== 1) {
    throw new Error(
      `withSceneLifecycle: expected ${label} exactly once in AppDelegate.swift, found ${matches}. ` +
        "The Expo template has likely changed; update this plugin.",
    );
  }
  return src.replace(search, replacement);
}

function withSceneManifest(config) {
  return withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = SCENE_MANIFEST;
    return cfg;
  });
}

function withSceneAppDelegate(config) {
  return withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const appDelegatePath = path.join(
        cfg.modRequest.platformProjectRoot,
        "ProstCounter",
        "AppDelegate.swift",
      );

      let src = fs.readFileSync(appDelegatePath, "utf-8");

      if (src.includes("ExpoReactNativeFactoryProvider")) {
        console.log("withSceneLifecycle: AppDelegate.swift already adopts scenes, skipping.");
        return cfg;
      }

      src = replaceExactlyOnce(
        src,
        CLASS_DECLARATION,
        CLASS_DECLARATION_WITH_PROVIDER,
        "the AppDelegate class declaration",
      );
      src = replaceExactlyOnce(
        src,
        START_REACT_NATIVE_BLOCK,
        START_REACT_NATIVE_REPLACEMENT,
        "the startReactNative block",
      );

      fs.writeFileSync(appDelegatePath, src, "utf-8");
      console.log("withSceneLifecycle: AppDelegate.swift now starts React Native from the scene.");

      return cfg;
    },
  ]);
}

module.exports = function withSceneLifecycle(config) {
  return withSceneAppDelegate(withSceneManifest(config));
};
