import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';

export default [
  { ignores: ['dist/', '.astro/', '.wrangler/', 'worker-configuration.d.ts', 'migration/'] },
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Migration scripts munge loosely shaped JSON from the Wix capture.
    files: ['scripts/**'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
];
