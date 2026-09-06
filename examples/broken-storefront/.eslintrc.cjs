module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  env: { browser: true, es2022: true },
  parserOptions: { ecmaVersion: "latest", sourceType: "module" },
  rules: {
    "no-console": "warn",
    "no-debugger": "error",
    "no-eval": "error",
    "no-var": "warn",
    "prefer-const": "warn",
    "eqeqeq": "warn",
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": "error"
  }
};
