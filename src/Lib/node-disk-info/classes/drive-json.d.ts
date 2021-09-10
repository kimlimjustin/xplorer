/**
 * Type for JSON version of drive.
 *
 * @author Cristiam Mercado
 */
export interface IDriveJson {
    /**
     * Drive filesystem.
     */
    filesystem: string;
    /**
     * Blocks associated to disk.
     */
    blocks: number;
    /**
     * Used disk space.
     */
    used: number;
    /**
     * Available disk space.
     */
    available: number;
    /**
     * Disk capacity.
     */
    capacity: string;
    /**
     * Indicates the mount point of the disk.
     */
    mounted: string;
}
