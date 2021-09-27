import storage from 'electron-json-storage-sync';
import Translate from '../I18n/i18n';
const userPreference = storage.get('preference')?.data; // Read user preference

/**
 * Option menu initializer
 * @returns {void}
 */
const optionMenu = (): void => {
	document.querySelector<HTMLElement>("[for='show-hidden-files']").innerText =
		Translate(
			document.querySelector<HTMLElement>("[for='show-hidden-files']")
				.innerText
		);
	(document.getElementById('show-hidden-files') as HTMLInputElement).checked =
		!userPreference?.hideHiddenFiles;
	document
		.getElementById('show-hidden-files')
		.addEventListener('change', (e) => {
			const hideHiddenFiles = !(e.target as HTMLInputElement).checked;
			storage.set(
				'preference',
				Object.assign({}, userPreference, { hideHiddenFiles })
			);
			document.getElementById('workspace').dataset.hideHiddenFiles =
				String(hideHiddenFiles);
		});
};

export default optionMenu;
