module.exports = ({ config }) => {
  const isDev =
    process.env.APP_VARIANT === 'development' ||
    process.env.EAS_BUILD_PROFILE === 'development' ||
    !process.env.APP_VARIANT;

  return {
    ...config,
    name: isDev ? 'Qooti Dev' : config.name || 'Qooti',
    scheme: isDev ? 'qooti-dev' : config.scheme || 'qooti',
    android: {
      ...config.android,
      package: isDev ? 'com.qooti.app.dev' : config.android?.package || 'com.qooti.app',
    },
  };
};
