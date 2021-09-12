"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var drive_1 = __importDefault(require("./drive"));
/**
 * Builder for Drive class.
 *
 * @author Cristiam Mercado
 */
var DriveBuilder = /** @class */ (function () {
    /**
     * Constructor.
     *
     * @param {Drive} drive Instance of Drive class.
     */
    function DriveBuilder(drive) {
        this.json = drive ? drive.toJSON() : {};
    }
    /**
     * Method to set filesystem property.
     *
     * @param {string} filesystem Drive filesystem.
     */
    DriveBuilder.prototype.filesystem = function (filesystem) {
        this.json.filesystem = filesystem;
        return this;
    };
    /**
     * Method to set blocks property.
     *
     * @param {number} blocks Blocks associated to disk.
     */
    DriveBuilder.prototype.blocks = function (blocks) {
        this.json.blocks = blocks;
        return this;
    };
    /**
     * Method to set used property.
     *
     * @param {number} used Used disk space.
     */
    DriveBuilder.prototype.used = function (used) {
        this.json.used = used;
        return this;
    };
    /**
     * Method to set available property.
     *
     * @param {number} available Available disk space.
     */
    DriveBuilder.prototype.available = function (available) {
        this.json.available = available;
        return this;
    };
    /**
     * Method to set capacity property.
     *
     * @param {string} capacity Disk capacity.
     */
    DriveBuilder.prototype.capacity = function (capacity) {
        this.json.capacity = capacity;
        return this;
    };
    /**
     * Method to set mounted property.
     *
     * @param {string} mounted Indicates the mount point of the disk.
     */
    DriveBuilder.prototype.mounted = function (mounted) {
        this.json.mounted = mounted;
        return this;
    };
    /**
     * Builds a Drive instance with data setted by methods.
     *
     * @return {Drive} Instance of Drive class.
     */
    DriveBuilder.prototype.build = function () {
        return drive_1.default.fromJSON(this.json);
    };
    return DriveBuilder;
}());
exports.DriveBuilder = DriveBuilder;
