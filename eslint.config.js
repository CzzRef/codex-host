import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

const typeScriptFiles = ["packages/**/*.ts", "tests/**/*.ts"];
const javaScriptFiles = [
  "*.config.js",
  "packages/**/scripts/**/*.mjs",
  "scripts/**/*.mjs",
  "tests/**/*.mjs",
  "tools/**/*.mjs",
];

export default [
  {
    ignores: [
      // Nested Git worktrees are separate checkouts of this same repository:
      // linting them from the parent double-reports and, when they sit on an
      // older commit, breaks type-aware parsing with two candidate roots.
      ".claude/worktrees/**",
      ".codexhost/**",
      ".pi/**",
      "build/**",
      "coverage/**",
      "node_modules/**",
      "openspec/**",
      "playwright-report/**",
      "reference/**",
      "target/**",
      "test-results/**",
      "**/dist/**",
    ],
  },
  {
    ...js.configs.recommended,
    files: javaScriptFiles,
    languageOptions: {
      globals: globals.node,
    },
  },
  ...tseslint.configs.strict.map((config) => ({
    ...config,
    files: typeScriptFiles,
  })),
  {
    files: typeScriptFiles,
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  {
    files: ["packages/renderer-extension/**/*.ts"],
    languageOptions: {
      globals: globals.browser,
    },
  },
];
