import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    files: ['**/*.ts', '**/*.tsx'], 
    languageOptions: {
      parserOptions: {
        project: true, 
      },
    },
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended, 
  eslintConfigPrettier,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  }
);