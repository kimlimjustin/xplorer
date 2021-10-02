import path from 'path';
import storage from 'electron-json-storage-sync';
import fs from 'fs';

/**
 * Register theme to Xplorer
 * @returns {any}
 */
const RegisterTheme = (): void => {
	//eslint-disable-next-line
	const extensionInformation = require(path.join(
		process.cwd(),
		'package.json'
	));
	const theme = storage.get('theme')?.data ?? [];
	const availableThemes = theme.availableThemes ?? [];
	if (!fs.existsSync(path.join(storage.getStorageDir, 'themes'))) {
		fs.mkdirSync(path.join(storage.getStorageDir, 'themes'));
	}
	fs.copyFileSync(
		path.join(process.cwd(), extensionInformation.main),
		path.join(storage.getStorageDir, 'themes', extensionInformation.main)
	);
	if (
		availableThemes.filter(
			//eslint-disable-next-line
			(theme: any) => theme.name !== extensionInformation.name
		).length === 0
	) {
		availableThemes.push({
			name: extensionInformation.themePackName,
			identifier: extensionInformation.name,
			category: extensionInformation.themeCategory,
			source: path.join(
				storage.getStorageDir,
				'themes',
				extensionInformation.main
			),
		});
	}
	theme.availableThemes = availableThemes;
	storage.set('theme', theme);
};

export default RegisterTheme;
