/** @type {import("prettier").Config} */
const config = {
  plugins: ["prettier-plugin-tailwindcss"],
  tailwindStylesheet: "./src/app/globals.css",

  printWidth: 100,
  tabWidth: 2,
  useTabs: false,

  semi: true,
  singleQuote: false,
  jsxSingleQuote: false,
  quoteProps: "as-needed",

  trailingComma: "all",
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: "always",

  endOfLine: "lf",
};

export default config;
