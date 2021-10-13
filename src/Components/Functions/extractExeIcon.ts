const extractExeIcon = (filePath: string): string => {
	const fs = require('fs');
	const path = require('path');
	const { extractIcon } = require('../../Lib/extracticon/bindings');
	const electron = require('electron');
	const basename =
		filePath.split(/[\\/]/)[filePath.split(/[\\/]/).length - 1];
	const app =
		electron.app || (electron.remote && electron.remote.app) || null;
	const EXE_ICON_CACHE_DIR = path.join(
		app.getPath('userData'),
		'Cache/Exe Icon'
	);

	// Create cache directory if not exist
	if (!fs.existsSync(EXE_ICON_CACHE_DIR)) {
		if (!fs.existsSync(path.join(EXE_ICON_CACHE_DIR, '..'))) {
			fs.mkdirSync(path.join(EXE_ICON_CACHE_DIR, '..'));
		}
		fs.mkdirSync(EXE_ICON_CACHE_DIR);
	}
	const ICON_FILE_NAME = path.join(EXE_ICON_CACHE_DIR, basename + '.ico');

	// Cache the icon parsed from the exe
	if (fs.existsSync(ICON_FILE_NAME)) {
		return ICON_FILE_NAME;
	} else {
		const buffer = extractIcon(filePath, 'large');
		fs.writeFileSync(ICON_FILE_NAME, buffer);
		return ICON_FILE_NAME;
	}
};
export default extractExeIcon;
