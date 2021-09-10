import Drive from '../classes/drive';
/**
 * Class with Linux specific logic to get disk info.
 */
export declare class Linux {
    /**
     * Execute specific Linux command to get disk info.
     *
     * @return {Drive[]} List of drives and their info.
     */
    static run(): Drive[];
}
