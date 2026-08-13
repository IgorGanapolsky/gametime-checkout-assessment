// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      "dist/*",
      "src/app/explore.tsx",
      "src/components/animated-icon.*",
      "src/components/app-tabs.*",
      "src/components/external-link.tsx",
      "src/components/hint-row.tsx",
      "src/components/themed-*.tsx",
      "src/components/ui/**",
      "src/components/web-badge.tsx",
      "src/hooks/use-color-scheme.web.ts",
      "src/hooks/use-theme.ts",
    ],
  }
]);
