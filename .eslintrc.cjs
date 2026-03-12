/**
 * Layer order (lowest → highest):
 *   0 types → 1 config → 2 classifier → 3 compactor → 4 router → 5 api → 6 dashboard
 *
 * Each module may only import from same or lower layers.
 * We use per-directory overrides with no-restricted-imports to enforce this
 * at lint time — faster feedback than waiting for `pnpm test`.
 */

// Helpers — build a no-restricted-imports pattern for a given layer.
// "forbidden" is every module strictly above the current layer.
const LAYERS = ["types", "config", "classifier", "compactor", "router", "api", "dashboard"];

/**
 * Build a no-restricted-imports rule value for a module at `layerIndex`.
 * @param {number} layerIndex
 * @returns {import('eslint').Linter.RuleEntry}
 */
function restrictAbove(layerIndex) {
  const forbidden = LAYERS.slice(layerIndex + 1);
  if (forbidden.length === 0) return "off";
  return [
    "error",
    {
      patterns: forbidden.map((mod) => ({
        group: [`../${mod}/*`, `../${mod}`, `./${mod}/*`, `./${mod}`],
        message: `Layer violation: cannot import from "${mod}/" (layer ${LAYERS.indexOf(mod)}) — only same or lower layers allowed. See ARCHITECTURE.md.`,
      })),
    },
  ];
}

/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    project: "./tsconfig.test.json",
  },
  plugins: ["@typescript-eslint", "jsdoc"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:jsdoc/recommended-typescript",
  ],
  rules: {
    // Enforce JSDoc on all exports
    "jsdoc/require-jsdoc": [
      "warn",
      {
        publicOnly: true,
        require: {
          FunctionDeclaration: true,
          MethodDefinition: true,
          ClassDeclaration: true,
          ArrowFunctionExpression: false,
          FunctionExpression: false,
        },
      },
    ],
    "jsdoc/require-param": "warn",
    "jsdoc/require-returns": "warn",
    "jsdoc/require-description": "off",

    // TypeScript strict rules
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_" },
    ],
    "@typescript-eslint/no-explicit-any": "error",

    // Allow TODO comments in stubs (for now)
    "no-warning-comments": "off",
  },
  overrides: [
    // ── Structured logging: no console.* in production source ──
    {
      files: ["src/**/*.ts"],
      rules: {
        "no-console": "error",
      },
    },

    // ── process.env restricted to config/ only ──
    // Config is the single source of truth for environment variables.
    // All other modules receive configuration via dependency injection.
    ...LAYERS.filter((mod) => mod !== "config").map((mod) => ({
      files: [`src/${mod}/**/*.ts`],
      rules: {
        "no-restricted-syntax": [
          "error",
          {
            selector: "MemberExpression[object.name='process'][property.name='env']",
            message: `Direct process.env access is not allowed in ${mod}/. ` +
              `Use config/ to read environment variables. See docs/conventions/security.md.`,
          },
        ],
      },
    })),

    // ── Layer dependency enforcement per module ──
    ...LAYERS.map((mod, i) => ({
      files: [`src/${mod}/**/*.ts`],
      rules: {
        "no-restricted-imports": restrictAbove(i),
      },
    })),
  ],
  ignorePatterns: ["dist", "node_modules", "*.cjs"],
};
