/**
 * Class with drive information.
 *
 * @author Cristiam Mercado
 */
export default class Drive {
    /**
     * Drive filesystem.
     */
    private readonly _filesystem;
    /**
     * Blocks associated to disk.
     */
    private readonly _blocks;
    /**
     * Used disk space.
     */
    private readonly _used;
    /**
     * Available disk space.
     */
    private readonly _available;
    /**
     * Disk capacity.
     */
    private readonly _capacity;
    /**
     * Indicates the mount point of the disk.
     */
    private readonly _mounted;
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
    constructor(filesystem: string, blocks: number, used: number, available: number, capacity: string, mounted: string);
    /**
     * Drive filesystem.
     *
     * @return Gets drive filesystem.
     */
    get filesystem(): string;
    /**
     * Blocks associated to disk.
     *
     * @return Gets blocks associated to disk.
     */
    get blocks(): number;
    /**
     * Used disk space.
     *
     * @return Gets used disk space.
     */
    get used(): number;
    /**
     * Available disk space.
     *
     * @return Gets available disk space.
     */
    get available(): number;
    /**
     * Disk capacity.
     *
     * @return Gets disk capacity.
     */
    get capacity(): string;
    /**
     * Indicates the mount point of the disk.
     *
     * @return Gets the mount point of the disk.
     */
    get mounted(): string;
}
