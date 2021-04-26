"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Class with drive information.
 *
 * @author Cristiam Mercado
 */
var Drive = /** @class */ (function () {
    /**
     * Constructor for Drive class.
     *
     * @param {string} filesystem Drive filesystem.
     * @param {number} blocks Blocks associated to disk.
     * @param {number} used Used disk space.
     * @param {number} available Available disk space.
     * @param {string} capacity Disk capacity.
     * @param {string} mounted Indicates the mount point of the disk.
     */
    function Drive(filesystem, blocks, used, available, capacity, mounted) {
        this._filesystem = filesystem;
        this._blocks = blocks;
        this._used = used;
        this._available = available;
        this._capacity = capacity;
        this._mounted = mounted;
    }
    Object.defineProperty(Drive.prototype, "filesystem", {
        /**
         * Drive filesystem.
         *
         * @return Gets drive filesystem.
         */
        get: function () {
            return this._filesystem;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Drive.prototype, "blocks", {
        /**
         * Blocks associated to disk.
         *
         * @return Gets blocks associated to disk.
         */
        get: function () {
            return this._blocks;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Drive.prototype, "used", {
        /**
         * Used disk space.
         *
         * @return Gets used disk space.
         */
        get: function () {
            return this._used;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Drive.prototype, "available", {
        /**
         * Available disk space.
         *
         * @return Gets available disk space.
         */
        get: function () {
            return this._available;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Drive.prototype, "capacity", {
        /**
         * Disk capacity.
         *
         * @return Gets disk capacity.
         */
        get: function () {
            return this._capacity;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Drive.prototype, "mounted", {
        /**
         * Indicates the mount point of the disk.
         *
         * @return Gets the mount point of the disk.
         */
        get: function () {
            return this._mounted;
        },
        enumerable: false,
        configurable: true
    });
    return Drive;
}());
exports.default = Drive;
