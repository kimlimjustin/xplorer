"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Windows = void 0;
var constants_1 = require("../utils/constants");
var drive_1 = __importDefault(require("../classes/drive"));
var utils_1 = require("../utils/utils");
/**
 * Class with Windows specific logic to get disk info.
 */
var Windows = /** @class */ (function () {
    function Windows() {
    }
    /**
     * Execute specific Windows command to get disk info.
     *
     * @return {Drive[]} List of drives and their info.
     */
    Windows.run = function () {
        var drives = [];
        var buffer = utils_1.Utils.execute(constants_1.Constants.WINDOWS_COMMAND);
        var lines = buffer.split('\r\r\n');
        var newDiskIteration = false;
        var caption = '';
        var description = '';
        var freeSpace = 0;
        var size = 0;
        lines.forEach(function (value) {
            if (value !== '') {
                var tokens = value.split('=');
                var section = tokens[0];
                var data = tokens[1];
                switch (section) {
                    case 'Caption':
                        caption = data;
                        newDiskIteration = true;
                        break;
                    case 'Description':
                        description = data;
                        break;
                    case 'FreeSpace':
                        freeSpace = isNaN(parseFloat(data)) ? 0 : +data;
                        break;
                    case 'Size':
                        size = isNaN(parseFloat(data)) ? 0 : +data;
                        break;
                }
            }
            else {
                if (newDiskIteration) {
                    var used = (size - freeSpace);
                    var percent = '0%';
                    if (size > 0) {
                        percent = Math.round((used / size) * 100) + '%';
                    }
                    var d = new drive_1.default(description, size, used, freeSpace, percent, caption);
                    drives.push(d);
                    newDiskIteration = false;
                    caption = '';
                    description = '';
                    freeSpace = 0;
                    size = 0;
                }
            }
        });
        return drives;
    };
    return Windows;
}());
exports.Windows = Windows;
