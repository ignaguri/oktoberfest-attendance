import tseslint from "typescript-eslint";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import unusedImports from "eslint-plugin-unused-imports";
import nextVitals from "eslint-config-next/core-web-vitals";
import prettierConfigRecommended from "eslint-plugin-prettier/recommended";

export default tseslint.config(
  // Ignore patterns must come first in flat config
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "dist/**",
      "node_modules/**",
      "next-env.d.ts",
      "public/workbox-*",
      "types/**",
      "**/.next/**",
      "**/dist/**",
      "**/build/**",
      "**/*.config.js",
      "**/*.config.mjs",
      "**/*.config.ts",
    ],
  },
  ...nextVitals,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        React: true,
        JSX: true,
      },
    },
    plugins: {
      "simple-import-sort": simpleImportSort,
      "unused-imports": unusedImports,
    },
    rules: {
      "no-console": "warn",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "react/display-name": "off",
      "react/jsx-curly-brace-presence": [
        "warn",
        {
          props: "never",
          children: "never",
        },
      ],
      "@typescript-eslint/consistent-type-imports": "error",
      "simple-import-sort/imports": "error",
      "unused-imports/no-unused-imports": "warn",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
      "simple-import-sort/exports": "error",
    },
  },
  // E2E override with its own TS project
  {
    files: ["e2e/**/*.ts", "e2e/**/*.tsx"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.eslint.json",
      },
    },
  },
  prettierConfigRecommended,
);
