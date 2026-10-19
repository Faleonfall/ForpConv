import tseslintPlugin from "@typescript-eslint/eslint-plugin";
import tseslintParser from "@typescript-eslint/parser";
import prettierConfig from "eslint-config-prettier/flat";
import vuePlugin from "eslint-plugin-vue";
import vueParser from "vue-eslint-parser";

// ESLint loads custom rules only through a plugin, so this one sits in an
// inline plugin named local. Long arrow functions become named functions.
const maxArrowLinesRule = {
  meta: {
    type: "suggestion",
    docs: { description: "limit arrow function length" },
    schema: [
      {
        type: "object",
        properties: { max: { type: "number" } },
        additionalProperties: false,
      },
    ],
    messages: {
      tooLong:
        "Arrow function has {{lines}} lines. Maximum allowed is {{max}}.",
    },
  },
  create(context) {
    const max = context.options[0]?.max ?? 100;

    return {
      ArrowFunctionExpression(node) {
        if (!node.loc) {
          return;
        }

        const lines = node.loc.end.line - node.loc.start.line + 1;

        if (lines > max) {
          context.report({ node, messageId: "tooLong", data: { lines, max } });
        }
      },
    };
  },
};

const plugins = {
  "@typescript-eslint": tseslintPlugin,
  local: { rules: { "max-arrow-lines": maxArrowLinesRule } },
};

const rules = {
  // Type and value imports from one module must share a line, so a module
  // is named exactly once per file and nothing drifts out of sync.
  "no-duplicate-imports": "error",
  "@typescript-eslint/no-explicit-any": "error",
  "@typescript-eslint/no-unused-vars": [
    "error",
    { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
  ],
  "@typescript-eslint/no-floating-promises": "error",
  "@typescript-eslint/no-misused-promises": [
    "error",
    { checksVoidReturn: false },
  ],
  // Inline rather than separate, so a type import never counts as a second
  // import of a module already imported for its values.
  "@typescript-eslint/consistent-type-imports": [
    "error",
    { prefer: "type-imports", fixStyle: "inline-type-imports" },
  ],
  "local/max-arrow-lines": ["error", { max: 100 }],
};

export default [
  {
    ignores: [
      "node_modules/",
      "frontend/dist/",
      "frontend/public/",
      "dist/",
      "build/",
      "coverage/",
    ],
  },
  ...vuePlugin.configs["flat/recommended"],
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tseslintParser,
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        // Every tsconfig in the repo, so typed rules see every file.
        project: ["./frontend/tsconfig.json"],
      },
    },
    plugins,
    rules,
  },
  {
    files: ["**/*.vue"],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslintParser,
        project: ["./frontend/tsconfig.json"],
        extraFileExtensions: [".vue"],
        sourceType: "module",
      },
    },
    plugins,
    rules,
  },
  {
    files: ["**/*.js", "**/*.cjs", "**/*.mjs"],
    languageOptions: { ecmaVersion: "latest", sourceType: "module" },
  },
  prettierConfig,
];
