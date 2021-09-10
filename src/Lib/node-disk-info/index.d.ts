import Drive from './classes/drive';
/**
 * Get disk info according current platform.
 *
 * @author Cristiam Mercado
 * @return {Promise<Drive[]>} Promise resolves array of disks and their info.
 */
export declare function getDiskInfo(): Promise<Drive[]>;
/**
 * Get disk info according current platform in an syncronous way.
 *
 * @author Cristiam Mercado
 * @return {Drive[]} Array of disks and their info.
 * @throws {Error} Current platform must be win32, linux or darwin.
 */
export declare function getDiskInfoSync(): Drive[];
