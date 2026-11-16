module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins || []),
    ...(process.env.APP_VARIANT === 'preview'
      ? [['expo-build-properties', { android: { usesCleartextTraffic: true } }]]
      : []),
  ],
});
