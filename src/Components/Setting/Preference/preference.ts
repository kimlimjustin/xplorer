import storage from 'electron-json-storage-sync';
import fs from 'fs';
import path from 'path';
import { reload } from '../../Layout/windowManager';
import ejs from 'ejs';
import Translate from '../../I18n/i18n';
/**
 * Create preference section
 * @returns {void}
 */
const Preference = (): void => {
	const availableLanguages = JSON.parse(
		fs.readFileSync(
			path.join(__dirname, '../../../Locales/index.json'),
			'utf-8'
		)
	)?.availableLanguages;
	let language =
		storage.get('preference')?.data?.language ?? navigator.language;
	if (Object.values(availableLanguages).indexOf(language) === -1)
		language = 'en-US';
	const hideHiddenFiles =
		storage.get('preference')?.data?.hideHiddenFiles ?? true;
	const hideSystemFiles =
		storage.get('preference')?.data?.hideSystemFiles ?? true;
	const dirAlongsideFiles =
		storage.get('preference')?.data?.dirAlongsideFiles ?? false;
	const settingsMain = document.querySelector('.settings-main');

	const appLanguage_i18n = Translate('App Language');
	const fileAndFolders_i18n = Translate('Files and Folders');
	const hideHiddenFiles_i18n = Translate('Hide hidden files');
	const hideSystemFiles_i18n = Translate('Hide system files');
	const dirAlongsideFiles_i18n = Translate(
		'List and sort directories alongside files'
	);
	ejs.renderFile(path.join(__dirname, 'preference.ejs'), {
		language,
		hideHiddenFiles,
		hideSystemFiles,
		dirAlongsideFiles,
		availableLanguages,
		appLanguage_i18n,
		fileAndFolders_i18n,
		hideHiddenFiles_i18n,
		hideSystemFiles_i18n,
		dirAlongsideFiles_i18n,
	}).then((result) => {
		settingsMain.innerHTML = result;
		settingsMain
			.querySelector(`[name="language"]`)
			.addEventListener(
				'change',
				(event: Event & { target: HTMLInputElement }) => {
					const preference = storage.get('preference')?.data ?? {};
					preference.language = event.target.value;
					storage.set('preference', preference);
					reload();

					document.querySelector(
						'.sidebar-setting-btn-text'
					).innerHTML = Translate('Settings');
					Preference();
				}
			);
		settingsMain
			.querySelector(`[name="hide-hidden-files"]`)
			.addEventListener(
				'change',
				(event: Event & { target: HTMLInputElement }) => {
					const preference = storage.get('preference')?.data ?? {};
					preference.hideHiddenFiles = event.target.checked;
					storage.set('preference', preference);
					document.getElementById(
						'workspace'
					).dataset.hideHiddenFiles = String(event.target.checked);
					(
						document.getElementById(
							'show-hidden-files'
						) as HTMLInputElement
					).checked = !event.target.checked;
				}
			);
		settingsMain
			.querySelector(`[name="hide-system-files"]`)
			.addEventListener(
				'change',
				(event: Event & { target: HTMLInputElement }) => {
					const preference = storage.get('preference')?.data ?? {};
					preference.hideSystemFiles = event.target.checked;
					storage.set('preference', preference);
					reload();
				}
			);
		settingsMain
			.querySelector(`[name="dirAlongsideFiles"]`)
			.addEventListener(
				'change',
				(event: Event & { target: HTMLInputElement }) => {
					const preference = storage.get('preference')?.data ?? {};
					preference.dirAlongsideFiles = event.target.checked;
					storage.set('preference', preference);
					reload();
				}
			);
	});
};

export default Preference;
