/**
 * Join multiple path into a string.
 * @param {string[]} ...args paths
 * @returns {string}
 */
const joinPath = (...args: string[]): string => {
	if (args.length === 0) return '.';
	let joined;
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg.length > 0) {
			if (joined === undefined) joined = arg;
			else {
				if (!(joined?.endsWith('/') || joined?.endsWith('\\')))
					joined += '/';
				joined += arg;
			}
		}
	}
	if (joined === undefined) return '.';
	return joined;
};

export default joinPath;
