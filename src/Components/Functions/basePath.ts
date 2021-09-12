import path from 'path';
/**
 * Get drive's base path of a path
 * @param {string} src - path
 * @returns {string} base path result
 */
const getDriveBasePath = (src: string): string => {
    return process.platform === 'win32'
        ? escape(path.resolve(src, '/'))
        : escape(src);
};

export default getDriveBasePath;
