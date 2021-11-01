/**
 * Get dirname of the path
 * @param {string} path path to be evaluated
 * @returns {any} result of the evaluated path
 */
const getDirname = (path: string): string => {
	if (path.length === 0) return '.';
	let code = path.charCodeAt(0);
	const hasRoot = code === 47 || code === 92; /*/*/
	let end = -1;
	let matchedSlash = true;
	for (let i = path.length - 1; i >= 1; --i) {
		code = path.charCodeAt(i);
		if (code === 47 || code === 92) {
			if (!matchedSlash) {
				end = i;
				break;
			}
		} else {
			// We saw the first non-path separator
			matchedSlash = false;
		}
	}
	if (end === -1) return hasRoot ? '/' : '.';
	if (hasRoot && end === 1) return '//';
	const result = path.slice(0, end);
	if (!(result.endsWith('/') || result.endsWith('\\'))) return result + '/';
};
export default getDirname;
