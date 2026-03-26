import Constants from 'expo-constants';

const packageJson = require('../../package.json');

export function getAppVersion(): string {
  return packageJson.version ?? Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? 'unknown';
}

export function getAppVersionLabel(): string {
  return `Version ${getAppVersion()}`;
}
