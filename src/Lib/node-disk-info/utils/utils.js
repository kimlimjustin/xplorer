"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Utils = void 0;
var os = __importStar(require("os"));
var child_process_1 = require("child_process");
/**
 * Class with utilitary methods.
 */
var Utils = /** @class */ (function () {
    function Utils() {
    }
    /**
     * Detects current platform.
     *
     * @return {string} Platform: win32, linux, darwin.
     */
    Utils.detectPlatform = function () {
        return os.platform().toLowerCase();
    };
    /**
     * Executes a command in SO console.
     *
     * @param {string} command: Command to execute.
     */
    Utils.execute = function (command) {
        return child_process_1.execSync(command).toString();
    };
    return Utils;
}());
exports.Utils = Utils;
