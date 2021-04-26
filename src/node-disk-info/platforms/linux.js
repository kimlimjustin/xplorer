"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Linux = void 0;
var constants_1 = require("../utils/constants");
var drive_1 = __importDefault(require("../classes/drive"));
var utils_1 = require("../utils/utils");
/**
 * Class with Linux specific logic to get disk info.
 */
var Linux = /** @class */ (function () {
    function Linux() {
    }
    /**
     * Execute specific Linux command to get disk info.
     *
     * @return {Drive[]} List of drives and their info.
     */
    Linux.run = function () {
        var drives = [];
        var buffer = utils_1.Utils.execute(constants_1.Constants.LINUX_COMMAND);
        var lines = buffer.split('\n');
        lines.forEach(function (value) {
            if (value !== '') {
                var line = value.replace(/ +(?= )/g, '');
                var tokens = line.split(' ');
                var d = new drive_1.default(tokens[0], isNaN(parseFloat(tokens[1])) ? 0 : +tokens[1], isNaN(parseFloat(tokens[2])) ? 0 : +tokens[2], isNaN(parseFloat(tokens[3])) ? 0 : +tokens[3], tokens[4], tokens[5]);
                drives.push(d);
            }
        });
        return drives;
    };
    return Linux;
}());
exports.Linux = Linux;
