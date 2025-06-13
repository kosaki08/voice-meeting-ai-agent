/** @typedef  {import("@ianvs/prettier-plugin-sort-imports").PluginConfig} SortImportsConfig */
/** @type {import('prettier').Config & SortImportsConfig} */
const config = {
  plugins: ["@ianvs/prettier-plugin-sort-imports"],
  importOrder: ["^(react/(.*)$)|^(react$)", "^(next/(.*)$)|^(next$)", "<THIRD_PARTY_MODULES>", "^~/", "^types$", "^[../]", "^[./]"],
  importOrderParserPlugins: ["typescript", "jsx", "decorators"],
  printWidth: 140,
  importOrderTypeScriptVersion: "5.4.2",
};
export default config;
