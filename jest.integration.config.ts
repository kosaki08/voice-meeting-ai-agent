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
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@ports/(.*)$": "<rootDir>/src/ports/$1",
    "^@adapters/(.*)$": "<rootDir>/src/adapters/$1",
    "^@domain/(.*)$": "<rootDir>/src/domain/$1",
    // src配下のみの相対パスを変換
    "^((?:\\.{1,2}/)+src/.*)\\.js$": "$1.ts",
  },
  testMatch: ["<rootDir>/tests/integration/**/*.test.ts"],
  testTimeout: 30000, // 統合テストは長時間かかる可能性があるため
  // CI環境では detectOpenHandles を有効化、ローカルでは forceExit
  detectOpenHandles: process.env.CI ? true : false,
  forceExit: process.env.CI ? false : true,
  setupFilesAfterEnv: ["<rootDir>/tests/integration/setup.ts"],
};

export default config;
