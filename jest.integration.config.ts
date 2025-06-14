import type { JestConfigWithTsJest } from "ts-jest";

const config: JestConfigWithTsJest = {
  preset: "ts-jest/presets/default-esm",
  extensionsToTreatAsEsm: [".ts"],
  clearMocks: true,
  coverageProvider: "v8",
  testEnvironment: "node",
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
  testMatch: ["<rootDir>/tests/integration/**/*.test.ts"],
  testTimeout: 30000, // 統合テストは長時間かかる可能性があるため
  // CI環境では detectOpenHandles を有効化、ローカルでは forceExit
  detectOpenHandles: process.env.CI ? true : false,
  forceExit: process.env.CI ? false : true,
  setupFilesAfterEnv: ["<rootDir>/tests/integration/setup.ts"],
};

export default config;
