/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import NotificationService from './src/services/NotificationService';

// Daftarkan background service untuk menangani notifikasi
NotificationService.registerHeadlessTask();

AppRegistry.registerComponent(appName, () => App);
