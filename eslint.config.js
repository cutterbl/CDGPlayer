// eslint.config.js
import globals from "globals";
import js from "@eslint/js";

export default [
  // 1. Global settings for the entire project
  {
    ...js.configs.recommended,
    ignores: ["node_modules/", "dist/", ".*"],
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": "warn", // Set unused vars to WARNING for the whole project
      "no-console": "off",      // Allow console.log everywhere
    },
  },

  // 2. Configuration for Node.js files
  {
    // Corrected glob pattern to include .mjs files
    files: ["**/*.config.js", "**/*.config.mjs", "scripts/server.js"], 
    languageOptions: {
      globals: {
        ...globals.node,      // Enables Node.js globals
        "URL": "readonly",     // Specifically allow the URL global for Rollup
      },
    },
  },

  // 3. Configuration for Browser source code
  {
    files: ["src/**/*.js", "scripts/index.js"],
    languageOptions: {
      globals: {
        ...globals.browser, // Enables browser globals
        "process": "readonly", // Allow 'process' global in browser context for this project
        "JSZip": "readonly",
        "JSZipUtils": "readonly",
        "jsmediatags": "readonly",
        "PromiseUtils": "readonly",
      },
    },
  },
];