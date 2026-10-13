import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import ts from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import vue from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';
import prettier from 'eslint-plugin-prettier/recommended';
import comments from '@eslint-community/eslint-plugin-eslint-comments';
import globals from 'globals';
export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/build/**',
      '**/dist/**',
      '**/.cpack_artifacts/**',
      '**/.vscode/**',
      '**/public/**',
      '**/src_assets/types/**',
      '.d.ts',
      '**/third-party/**',
      '**/coverage/**',
      '*.md',
      '*.MD',
      '*.yml',
      '*.yaml',
      '**/*.md',
      '**/*.MD',
      '**/*.yml',
      '**/*.yaml',
    ],
  },
  { files: ['**/*.{js,mjs,cjs,ts,mts,tsx,vue}'], ...js.configs.recommended },
  ...ts.configs['flat/recommended-type-checked'],
  ...vue.configs['flat/recommended'],
  prettier,
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,tsx,vue}'],
    languageOptions: {
      parser: vueParser,
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        parser: tsParser,
        project: ['./tsconfig.json'],
        tsconfigRootDir: fileURLToPath(new URL('.', import.meta.url)),
        ecmaVersion: 2021,
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
      },
    },
    plugins: { 'eslint-comments': comments },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      'no-empty': 'warn',
      'no-prototype-builtins': 'off',
      '@typescript-eslint/no-restricted-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'no-unused-vars': 'off',
      'prettier/prettier': 'error',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
        },
      ],
      'vue/multi-word-component-names': 'off',
    },
  },
  {
    files: ['**/*.vue'],
    rules: {
      'no-undef': 'off',
    },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      parserOptions: { sourceType: 'commonjs' },
    },
  },
  {
    files: ['**/*.ts', '**/*.mts', '**/*.tsx', '**/*.vue'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        {
          assertionStyle: 'as',
          objectLiteralTypeAssertions: 'never',
        },
      ],
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-ignore': true,
          'ts-nocheck': true,
          'ts-check': false,
          'ts-expect-error': true,
          minimumDescriptionLength: 8,
        },
      ],
      'eslint-comments/no-unlimited-disable': 'error',
      'eslint-comments/require-description': [
        'error',
        {
          ignore: [],
        },
      ],
      '@typescript-eslint/no-empty-object-type': 'error',
      '@typescript-eslint/no-unsafe-function-type': 'error',
      '@typescript-eslint/no-wrapper-object-types': 'error',
      '@typescript-eslint/no-restricted-types': [
        'error',
        {
          types: {
            '{}': {
              message: 'Use a specific object shape or Record<string, unknown>.',
            },
            object: {
              message: 'Use a specific object type.',
            },
            null: {
              message: 'Avoid `null` types; model absence with optional props or ADTs.',
            },
            undefined: {
              message: 'Avoid `undefined` types; use optionals or domain types.',
            },
          },
        },
      ],
      '@typescript-eslint/consistent-indexed-object-style': ['error', 'record'],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSUnionType > TSNullKeyword',
          message:
            'Do not use `null` in union types. Prefer optional props or a domain sum type (e.g., Option).',
        },
        {
          selector: 'TSUnionType > TSUndefinedKeyword',
          message: 'Do not use `undefined` in union types. Prefer optional props (foo?: T).',
        },
        {
          selector: 'TSAsExpression > TSAnyKeyword',
          message: 'Do not cast to `any`.',
        },
        {
          selector:
            "TSAsExpression[right.type='TSTypeReference'] > TSAsExpression > TSUnknownKeyword",
          message: 'Do not double-assert via `unknown`. Fix the types instead.',
        },
      ],
      '@typescript-eslint/restrict-plus-operands': 'error',
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        {
          allowNumber: true,
          allowBoolean: false,
          allowAny: false,
          allowNullish: false,
        },
      ],
      '@typescript-eslint/no-base-to-string': 'error',
    },
  },
  {
    files: ['**/*.d.ts', '**/generated/**', '**/*.gen.ts', '**/*.gen.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-restricted-types': 'off',
      'no-restricted-syntax': 'off',
    },
  },
];
