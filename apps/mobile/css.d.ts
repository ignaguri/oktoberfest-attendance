// TS 7 checks side-effect imports. The declaration that covers `import "../global.css"`
// otherwise comes from the gitignored expo-env.d.ts, which only exists after Expo has run.
declare module "*.css";
