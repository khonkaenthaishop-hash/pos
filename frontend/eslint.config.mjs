import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // These rules are overly strict for this codebase and currently
      // generate many false positives / noisy refactors.
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/immutability": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/static-components": "off",

      // ── Readability: file & function size ──────────────────────────────────
      'max-lines': ['warn', { max: 700, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['warn', { max: 500, skipBlankLines: true, skipComments: true }],
      'max-depth': ['warn', 4],

      // ── Built-in: Correctness ────────────────────────────────────────────────
      'eqeqeq': ['warn', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'no-useless-rename': 'error',
      'no-useless-computed-key': 'error',
      'prefer-const': 'error',

      // ── Built-in: Style & Readability ────────────────────────────────────────
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'object-shorthand': 'warn',
      'prefer-template': 'warn',
      'prefer-arrow-callback': 'warn',
      'no-nested-ternary': 'warn',
      'no-unneeded-ternary': 'warn',
      'no-else-return': 'warn',
      'no-lonely-if': 'warn',
      'no-useless-return': 'warn',
      'yoda': 'warn',
      'max-params': ['warn', 4],

      // ── TypeScript: additional ────────────────────────────────────────────────
      // prefer-optional-chain ต้องการ typed linting (parserOptions.project) — skip
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-require-imports': 'error',

      // ── React: additional ─────────────────────────────────────────────────────
      'react/no-array-index-key': 'warn',

      // ── Import: additional ────────────────────────────────────────────────────
      'import/no-duplicates': 'warn',
      'import/first': 'warn',
      'import/no-cycle': 'error',
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
