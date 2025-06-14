import type { JestConfigWithTsJest } from "ts-jest";

const config: JestConfigWithTsJest = {
  preset: "ts-jest/presets/default-esm",
  extensionsToTreatAsEsm: [".ts"],
  clearMocks: true,
  coverageProvider: "v8",
  testEnvironment: "node",
  testMatch: [
    "**/tests/unit/**/*.test.ts",
    "**/tests/integration/**/*.test.ts", // 統合テストも含める
  ],
  testPathIgnorePatterns: [
    "/node_modules/",
    "/dist/",
    "/tests/e2e/", // E2Eテストは別途実行
  ],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
      },
    ],
  },
  moduleNameMapper: {
    // 先に.js拡張子を処理
    "^@/(.+)\\.js$": "<rootDir>/src/$1",
    "^@ports/(.+)\\.js$": "<rootDir>/src/ports/$1",
    "^@adapters/(.+)\\.js$": "<rootDir>/src/adapters/$1",
    "^@core/(.+)\\.js$": "<rootDir>/src/core/$1",
    "^@utils/(.+)\\.js$": "<rootDir>/src/utils/$1",
    // 拡張子なしのパス
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@ports/(.*)$": "<rootDir>/src/ports/$1",
    "^@adapters/(.*)$": "<rootDir>/src/adapters/$1",
    "^@core/(.*)$": "<rootDir>/src/core/$1",
    "^@utils/(.*)$": "<rootDir>/src/utils/$1",
    // 相対パスの.js拡張子を除去
    "^(\\.{1,2}/.+)\\.js$": "$1",
  },
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
};

export default config;
