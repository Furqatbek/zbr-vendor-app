// ESLint flat config (ESLint 9). Extends Expo's recommended config.
const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    // Build/preflight scripts run in Node (CommonJS), not React Native.
    files: ['scripts/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'writable',
        require: 'readonly',
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
      },
    },
    rules: {
      // Guards against Metro inlining EXPO_PUBLIC_* at bundle time, so a
      // computed key silently reads undefined. These scripts are run by node
      // directly and never bundled, so the premise does not hold — and they
      // legitimately need computed lookups (npm_config_*, per-key validation).
      'expo/no-dynamic-env-var': 'off',
    },
  },
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.expo/**',
      'babel.config.js',
      'jest.setup.js',
    ],
  },
];
