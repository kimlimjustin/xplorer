"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
switch (process.platform) {
    case "win32":
        var module = require('../../build/Release/module');
        exports.extractIcon = module.extractIcon;;
        break;
    default:
        exports.extractIcon = null;
}