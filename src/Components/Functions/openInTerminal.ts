/**
 * Open a folder in terminal
 * @param {string} folderPath
 * @returns {any}
 */
const openInTerminal = (folderPath: string): void => {
	const { execSync } = require('child_process');
	if (process.platform === 'win32') {
		execSync(
			`${folderPath.split('\\')[0]} && cd ${folderPath} && start cmd`
		);
	} else if (process.platform === 'linux') {
		execSync(`gnome-terminal --working-directory="${folderPath}"`);
	} else {
		execSync(`open -a Terminal ${folderPath}`);
	}
};

export default openInTerminal;
