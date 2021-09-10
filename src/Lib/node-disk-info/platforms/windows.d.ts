import Drive from '../classes/drive';
/**
 * Class with Windows specific logic to get disk info.
 */
export declare class Windows {
    /**
     * Execute specific Windows command to get disk info.
     *
     * @return {Drive[]} List of drives and their info.
     */
    static run(): Drive[];
}
