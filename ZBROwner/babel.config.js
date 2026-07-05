module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Strip console.* from release builds (keeps console.error for crash
    // diagnostics). Belt-and-suspenders against accidental PII/log leakage;
    // individual debug logs are also removed at the source.
    env: {
      production: {
        plugins: [['transform-remove-console', { exclude: ['error'] }]],
      },
    },
  };
};
