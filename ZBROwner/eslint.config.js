// ESLint flat config (ESLint 9). Extends Expo's recommended config.
const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
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
