/**
 * Return the last portion of a path.
 * @param {string} path the path to be evaluated
 * @returns {string}
 */
const basename = (path: string): string =>
	path
		.replace(/(\\|\/)$/g, '')
		.split(/[\\/]/)
		.pop();
export default basename;
