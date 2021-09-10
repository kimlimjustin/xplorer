import Drive from './drive';
/**
 * Builder for Drive class.
 *
 * @author Cristiam Mercado
 */
export declare class DriveBuilder {
    /**
     * Private JSON instance of Drive class.
     */
    private readonly json;
    /**
     * Constructor.
     *
     * @param {Drive} drive Instance of Drive class.
     */
    constructor(drive?: Drive);
    /**
     * Method to set filesystem property.
     *
     * @param {string} filesystem Drive filesystem.
     */
    filesystem(filesystem: string): DriveBuilder;
    /**
     * Method to set blocks property.
     *
     * @param {number} blocks Blocks associated to disk.
     */
    blocks(blocks: number): DriveBuilder;
    /**
     * Method to set used property.
     *
     * @param {number} used Used disk space.
     */
    used(used: number): DriveBuilder;
    /**
     * Method to set available property.
     *
     * @param {number} available Available disk space.
     */
    available(available: number): DriveBuilder;
    /**
     * Method to set capacity property.
     *
     * @param {string} capacity Disk capacity.
     */
    capacity(capacity: string): DriveBuilder;
    /**
     * Method to set mounted property.
     *
     * @param {string} mounted Indicates the mount point of the disk.
     */
    mounted(mounted: string): DriveBuilder;
    /**
     * Builds a Drive instance with data setted by methods.
     *
     * @return {Drive} Instance of Drive class.
     */
    build(): Drive;
}
