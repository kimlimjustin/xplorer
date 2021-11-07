import { reload } from '../../Layout/windowManager';
import Translate from '../../I18n/i18n';
import LocalesAPI from '../../../Api/locales';
import Storage from '../../../Api/storage';
let localesData: LocalesAPI;
/**
 * Create preference section
 * @returns {Promise<void>}
 */
const Preference = async (): Promise<void> => {
	if (!localesData) {
		localesData = new LocalesAPI();
		localesData.build();
	}
	const _preference = await Storage.get('preference');
	let language = _preference?.language ?? navigator.language;
	if (Object.values(localesData.AVAILABLE_LOCALES).indexOf(language) === -1) language = 'en-US';
	const hideHiddenFiles = _preference?.hideHiddenFiles ?? true;
	const hideSystemFiles = _preference?.hideSystemFiles ?? true;
	const dirAlongsideFiles = _preference?.dirAlongsideFiles ?? false;
	const settingsMain = document.querySelector('.settings-main');

	const appLanguage_i18n = await Translate('App Language');
	const fileAndFolders_i18n = await Translate('Files and Folders');
	const hideHiddenFiles_i18n = await Translate('Hide hidden files');
	const hideSystemFiles_i18n = await Translate('Hide system files');
	const dirAlongsideFiles_i18n = await Translate('List and sort directories alongside files');
	const preferencePage = `<h3 class="settings-title">${appLanguage_i18n}</h3>
	<select name="language">
	${Object.keys(localesData.AVAILABLE_LOCALES)
		.map(
			(lang) =>
				`<option value="${localesData.AVAILABLE_LOCALES[lang]}" ${
					localesData.AVAILABLE_LOCALES[lang] === language ? 'selected' : ''
				}>${lang}</option>`
		)
		.join('')}
	</select>
	<h3 class="settings-title">${fileAndFolders_i18n}</h3>
	<div class="toggle-box">
		<label class="toggle">
			<input type="checkbox" name="hide-hidden-files" ${hideHiddenFiles ? 'checked' : ''}>
			<span class="toggle-slider"></span>
			<span class="toggle-label">${hideHiddenFiles_i18n}</span>
		</label>
	</div>
	<div class="toggle-box">
		<label class="toggle">
			<input type="checkbox" name="hide-system-files"${hideSystemFiles ? 'checked' : ''}>
			<span class="toggle-slider"></span>
			<span class="toggle-label">${hideSystemFiles_i18n}</span>
		</label>
	</div>
	<div class="toggle-box">
		<label class="toggle">
			<input type="checkbox" name="dirAlongsideFiles" ${dirAlongsideFiles ? 'checked' : ''}>
			<span class="toggle-slider"></span>
			<span class="toggle-label">${dirAlongsideFiles_i18n}</span>
		</label>
	</div>`;
	settingsMain.innerHTML = preferencePage;
	settingsMain.querySelector(`[name="language"]`).addEventListener('change', async (event: Event & { target: HTMLInputElement }) => {
		const preference = await Storage.get('preference');
		preference.language = event.target.value;
		Storage.set('preference', preference);
		reload();

		document.querySelector('.sidebar-setting-btn-text').innerHTML = await Translate('Settings');
		Preference();
	});
	settingsMain.querySelector(`[name="hide-hidden-files"]`).addEventListener('change', async (event: Event & { target: HTMLInputElement }) => {
		const preference = await Storage.get('preference');
		preference.hideHiddenFiles = event.target.checked;
		Storage.set('preference', preference);
		document.getElementById('workspace').dataset.hideHiddenFiles = String(event.target.checked);
	});
	settingsMain.querySelector(`[name="hide-system-files"]`).addEventListener('change', async (event: Event & { target: HTMLInputElement }) => {
		const preference = await Storage.get('preference');
		preference.hideSystemFiles = event.target.checked;
		Storage.set('preference', preference);
		reload();
	});
	settingsMain.querySelector(`[name="dirAlongsideFiles"]`).addEventListener('change', async (event: Event & { target: HTMLInputElement }) => {
		const preference = await Storage.get('preference');
		preference.dirAlongsideFiles = event.target.checked;
		Storage.set('preference', preference);
		reload();
	});
};

export default Preference;
