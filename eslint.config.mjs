import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import jestPlugin from "eslint-plugin-jest";
import prettier from "eslint-plugin-prettier";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**", "playground.ts", "**/*.playground.ts"],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        project: "./tsconfig.json",
      },
      globals: globals.node,
    },
    plugins: { "@typescript-eslint": tseslint },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...tseslint.configs.strict.rules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // non-null assertionは原則禁止
      "@typescript-eslint/no-non-null-assertion": "error",
      // テスト用のクラスなどで必要な場合があるため許可
      "@typescript-eslint/no-extraneous-class": "off",
    },
  },
  {
    plugins: { prettier },
    rules: {
      "prettier/prettier": "error",
    },
  },
  {
    files: ["**/*.test.ts", "**/*.spec.ts", "tests/**/*.ts"],
    plugins: {
      jest: jestPlugin,
    },
    languageOptions: {
      globals: { ...globals.node, ...globals.jest, fail: "readonly" },
    },
    rules: {
      ...jestPlugin.configs["flat/recommended"].rules,
      "@typescript-eslint/no-explicit-any": "off",
      "jest/no-conditional-expect": "off",
    },
  },
];
