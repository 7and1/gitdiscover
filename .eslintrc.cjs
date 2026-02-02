module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true
  },
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "prettier"],
  ignorePatterns: ["**/node_modules/**", "**/dist/**", "**/.next/**", "docker/data/**"],
  rules: {
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }]
  }
};

