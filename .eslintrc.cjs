/**
 * Package order (lowest → highest):
 *   0 types → 1 config → 2 telemetry → 3 optimization → 4 monitoring → 5 cli → 6 api → 7 dashboard
 *
 * Each package may only import from same or lower layers.
 * We use per-directory overrides with no-restricted-imports to enforce this
 * at lint time — faster feedback than waiting for `pnpm test`.
 */

// Helpers — build a no-restricted-imports pattern for a given layer.
// "forbidden" is every package strictly above the current layer.
const PACKAGES = ["types", "config", "telemetry", "optimization", "monitoring", "cli", "api", "dashboard"];

/**
 * Build a no-restricted-imports rule value for a package at `layerIndex`.
 * Cross-package imports use workspace names like `@greenclaw/<pkg>`.
 * @param {number} layerIndex
 * @returns {import('eslint').Linter.RuleEntry}
 */
function restrictAbove(layerIndex) {
  const forbidden = PACKAGES.slice(layerIndex + 1);
  if (forbidden.length === 0) return "off";
  return [
    "error",
    {
      patterns: forbidden.map((pkg) => ({
        group: [`@greenclaw/${pkg}`, `@greenclaw/${pkg}/*`],
        message: `Layer violation: cannot import from "@greenclaw/${pkg}" (layer ${PACKAGES.indexOf(pkg)}) — only same or lower layers allowed. See ARCHITECTURE.md.`,
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
      files: ["packages/*/src/**/*.ts"],
      rules: {
        "no-console": "error",
      },
    },

    // ── process.env restricted to config package only ──
    // Config is the single source of truth for environment variables.
    // All other packages receive configuration via dependency injection.
    ...PACKAGES.filter((pkg) => pkg !== "config").map((pkg) => ({
      files: [`packages/${pkg}/src/**/*.ts`],
      rules: {
        "no-restricted-syntax": [
          "error",
          {
            selector: "MemberExpression[object.name='process'][property.name='env']",
            message: `Direct process.env access is not allowed in ${pkg}/. ` +
              `Use config package to read environment variables. See docs/conventions/security.md.`,
          },
        ],
      },
    })),

    // ── Layer dependency enforcement per package ──
    ...PACKAGES.map((pkg, i) => ({
      files: [`packages/${pkg}/src/**/*.ts`],
      rules: {
        "no-restricted-imports": restrictAbove(i),
      },
    })),
  ],
  ignorePatterns: ["dist", "node_modules", "*.cjs"],
};
