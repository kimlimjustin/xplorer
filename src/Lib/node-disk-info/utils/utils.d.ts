/**
 * Class with utilitary methods.
 */
export declare class Utils {
    /**
     * Detects current platform.
     *
     * @return {string} Platform: win32, linux, darwin.
     */
    static detectPlatform(): string;
    /**
     * Executes a command in SO console.
     *
     * @param {string} command: Command to execute.
     */
    static execute(command: string): string;
}
