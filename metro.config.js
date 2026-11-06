const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite's web worker loads its WASM binary through the asset pipeline.
// Native builds are unaffected; this only enables the optional web preview.
config.resolver.assetExts.push('wasm');

module.exports = config;
