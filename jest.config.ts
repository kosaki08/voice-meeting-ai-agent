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
};

export default config;
