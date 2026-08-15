module.exports = {
  launchImageLibraryAsync: async () => ({ canceled: true, assets: [] }),
  requestCameraPermissionsAsync: async () => ({ status: 'denied' }),
  launchCameraAsync: async () => ({ canceled: true, assets: [] }),
  MediaTypeOptions: { Images: 'Images' },
};
