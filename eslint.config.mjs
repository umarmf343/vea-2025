import { FlatCompat } from '@eslint/eslintrc';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default [
  ...compat.config({
    extends: ['next/core-web-vitals', 'plugin:@typescript-eslint/recommended'],
    plugins: ['@typescript-eslint', 'react-hooks'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'localStorage',
          message: "Use safeStorage from @/lib/safe-storage instead of direct localStorage access for SSR safety",
        },
        {
          name: 'sessionStorage',
          message: "Use safeSessionStorage from @/lib/safe-storage instead of direct sessionStorage access for SSR safety",
        },
        {
          name: 'window',
          message: "Wrap window access in an SSR-safe typeof window !== 'undefined' check",
        },
        {
          name: 'document',
          message: "Wrap document access in an SSR-safe typeof document !== 'undefined' check",
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'window',
          property: 'localStorage',
          message: "Use safeStorage from @/lib/safe-storage instead of window.localStorage for SSR safety",
        },
        {
          object: 'window',
          property: 'sessionStorage',
          message: "Use safeSessionStorage from @/lib/safe-storage instead of window.sessionStorage for SSR safety",
        },
      ],
      'no-console': 'warn',
      'no-alert': 'error',
      'no-debugger': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
    },
    overrides: [
      {
        files: ['app/api/**/*.ts', 'lib/**/*.ts'],
        rules: {
          'no-restricted-globals': [
            'error',
            {
              name: 'window',
              message: 'Server-side files should not access window object',
            },
            {
              name: 'document',
              message: 'Server-side files should not access document object',
            },
            {
              name: 'localStorage',
              message: 'Server-side files should not access localStorage',
            },
            {
              name: 'sessionStorage',
              message: 'Server-side files should not access sessionStorage',
            },
          ],
        },
      },
    ],
  }),
];
