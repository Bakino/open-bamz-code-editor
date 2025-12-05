import globals from "globals";
import pluginJs from "@eslint/js";


export default [
  {files: ["**/*.mjs"], languageOptions: {sourceType: "module"}},
  {languageOptions: { globals: {...globals.browser, ...globals.node} }},
  pluginJs.configs.recommended,
];