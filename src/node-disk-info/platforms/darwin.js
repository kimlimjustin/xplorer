"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Darwin = void 0;
var constants_1 = require("../utils/constants");
var drive_1 = __importDefault(require("../classes/drive"));
var utils_1 = require("../utils/utils");
/**
 * Class with OSX specific logic to get disk info.
 */
var Darwin = /** @class */ (function () {
    function Darwin() {
    }
    /**
     * Execute specific OSX command to get disk info.
     *
     * @return {Drive[]} List of drives and their info.
     */
    Darwin.run = function () {
        var drives = [];
        var buffer = utils_1.Utils.execute(constants_1.Constants.DARWIN_COMMAND);
        var lines = buffer.split('\n');
        lines.forEach(function (value, index, array) {
            if (value !== '') {
                var line = value.replace(/ +(?= )/g, '');
                var tokens = line.split(' ');
                var d = new drive_1.default(tokens[0], isNaN(parseFloat(tokens[1])) ? 0 : +tokens[1], isNaN(parseFloat(tokens[2])) ? 0 : +tokens[2], isNaN(parseFloat(tokens[3])) ? 0 : +tokens[3], tokens[4], tokens[5]);
                drives.push(d);
            }
        });
        return drives;
    };
    return Darwin;
}());
exports.Darwin = Darwin;
