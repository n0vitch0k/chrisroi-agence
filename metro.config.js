const { getDefaultConfig } = require('@expo/metro-config');
const path = require('path');

module.exports = (api) => {
  const projectRoot = __dirname;
  const config = getDefaultConfig(projectRoot);

  if (api.platform === 'web') {
    config.resolver.extraNodeModules = {
      ...(config.resolver.extraNodeModules || {}),
      'expo-sqlite': path.resolve(projectRoot, 'src/utils/expoSqliteStub.js'),
      'expo-image-picker': path.resolve(projectRoot, 'src/utils/expoImagePickerStub.js'),
      'uuid': path.resolve(projectRoot, 'src/utils/uuidStub.js'),
    };
  }

  return config;
};
