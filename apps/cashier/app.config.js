const applyDevConfig = require('../../expo-dev-config');
const applyDeepLinks = require('../../expo-deep-links');
const applyWhiteLabel = require('../../expo-white-label');
const appJson = require('./app.json');

/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  expo: applyDevConfig(applyWhiteLabel(applyDeepLinks(appJson.expo), 'cashier')),
};
