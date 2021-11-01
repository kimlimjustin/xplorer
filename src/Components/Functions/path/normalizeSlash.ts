/**
 * Normalize slashes of a file path
 * @param {string} path
 * @returns {string}
 */
const NormalizeSlash = (path: string): string => {
	if (path === '\\' || path === '/') return '/';
	path = path.replace(/\\/g, '/');

	if (path.length === 2 && /.:/.test(path)) return path + '/';
	if (path.endsWith('/') && !(path.length === 3 && /.:\//.test(path)))
		return path.slice(0, path.length - 1);
	return path;
};
export default NormalizeSlash;
