module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        "babel-preset-expo",
        {
          // Preset would also inject worklets/reanimated; register once below (must be last).
          worklets: false,
          reanimated: false,
        },
      ],
    ],
    // Single Worklets plugin — avoids double-transform / stale version stamps.
    plugins: ["react-native-worklets/plugin"],
  };
};
