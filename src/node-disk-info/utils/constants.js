"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Constants = void 0;
/**
 * Class with constants used in the application.
 */
var Constants = /** @class */ (function () {
    function Constants() {
    }
    /**
     * Command to execute on Windows.
     */
    Constants.WINDOWS_COMMAND = 'wmic logicaldisk get Caption,FreeSpace,Size,VolumeSerialNumber,Description  /format:list';
    /**
     * Command to execute on Linux.
     */
    Constants.LINUX_COMMAND = 'df -P | awk \'NR > 1\'';
    /**
     * Command to execute on OSX.
     */
    Constants.DARWIN_COMMAND = 'df -P | awk \'NR > 1\'';
    return Constants;
}());
exports.Constants = Constants;
