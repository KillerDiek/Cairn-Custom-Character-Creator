import { moduleName } from './settings.js';

// Function to log messages if Dev mode is enabled
export function _log(message, ...args) {
    if (game.settings.get(moduleName, 'devMode')) {
        console.log(`Cairn Custom Character Creator | ${message}`, ...args);
    }
}