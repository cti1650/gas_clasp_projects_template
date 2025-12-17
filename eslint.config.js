const globals = require("globals");
const googleappsscript = require("eslint-plugin-googleappsscript");
const js = require("@eslint/js");
const prettier = require("eslint-config-prettier");

module.exports = [
  {
    ignores: ["**/node_modules/**", "**/dist/**", "**/*.min.js"]
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,ts}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.commonjs,
        ...googleappsscript.environments.googleappsscript.globals
      }
    },
    plugins: {
      googleappsscript
    },
    rules: {
      "no-unused-vars": "off",
      "no-undef": "off",
      "no-console": "off"
    }
  },
  prettier
];
