import { reload } from '../../Layout/windowManager';
import Translate from '../../I18n/i18n';
import LocalesAPI from '../../../Service/locales';
import Storage from '../../../Service/storage';
import { MAIN_BOX_ELEMENT } from '../../../Util/constants';
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
	const detectDriveChange = _preference?.detectDriveChange ?? false;
	const automaticallyChangePreviewFile = _preference?.automaticallyChangePreviewFile ?? true;
	const settingsMain = document.querySelector('.settings-main');
	const on_startup = _preference?.on_startup ?? 'new';
	const clickToOpenSidebar = _preference?.clickToOpenSidebar ?? 'single';
	const clickToOpenHome = _preference?.clickToOpenHome ?? 'double';
	const clickToOpenFile = _preference?.clickToOpenFile ?? 'double';
	const calculateSubFolderSize = _preference?.calculateSubFolderSize ?? false;

	const appLanguage_i18n = await Translate('App Language');
	const fileAndFolders_i18n = await Translate('Files and Folders');
	const hideHiddenFiles_i18n = await Translate('Hide hidden files');
	const hideSystemFiles_i18n = await Translate('Hide system files');
	const dirAlongsideFiles_i18n = await Translate('List and sort directories alongside files');
	const on_startup_i18n = await Translate('On startup');
	const newTab_i18n = await Translate('New tab');
	const continuePreviousSession_i18n = await Translate('Continue previous session');
	const detectDriveChange_i18n = await Translate('Detect Drive Change');
	const automaticallyChangePreviewFile_i18n = await Translate('Automatically change preview file with selected file');
	const clickToOpen_i18n = await Translate('Single/Double Click to open a file');
	const clickToOpenSidebar_i18n = await Translate('Double click to open items under sidebar section');
	const clickToOpenHome_i18n = await Translate('Double click to open items under home section');
	const clickToOpenFile_i18n = await Translate('Double click to open files/folders');
	const calculateSubFolderSize_i18n = await Translate('Calculate sub folder size');
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
	</div>
	<div class="toggle-box">
		<label class="toggle">
			<input type="checkbox" name="detect-drive-change" ${detectDriveChange ? 'checked' : ''}>
			<span class="toggle-slider"></span>
			<span class="toggle-label">${detectDriveChange_i18n}</span>
		</label>
	</div>
	<div class="toggle-box">
		<label class="toggle">
			<input type="checkbox" name="automatically-change-preview-file" ${automaticallyChangePreviewFile ? 'checked' : ''}>
			<span class="toggle-slider"></span>
			<span class="toggle-label">${automaticallyChangePreviewFile_i18n}</span>
		</label>
	</div>
	<div class="toggle-box">
		<label class="toggle">
			<input type="checkbox" name="calculate-subfolder-size" ${calculateSubFolderSize ? 'checked' : ''}>
			<span class="toggle-slider"></span>
			<span class="toggle-label">${calculateSubFolderSize_i18n}</span>
		</label>
	</div>
	<h3 class="settings-title">${clickToOpen_i18n}</h3>
	<div class="toggle-box">
		<label class="toggle">
			<input type="checkbox" name="click-to-open-sidebar" ${clickToOpenSidebar === 'double' ? 'checked' : ''}>
			<span class="toggle-slider"></span>
			<span class="toggle-label">${clickToOpenSidebar_i18n}</span>
		</label>
	</div>
	<div class="toggle-box">
		<label class="toggle">
			<input type="checkbox" name="click-to-open-home" ${clickToOpenHome === 'double' ? 'checked' : ''}>
			<span class="toggle-slider"></span>
			<span class="toggle-label">${clickToOpenHome_i18n}</span>
		</label>
	</div>
	<div class="toggle-box">
		<label class="toggle">
			<input type="checkbox" name="click-to-open-file" ${clickToOpenFile === 'double' ? 'checked' : ''}>
			<span class="toggle-slider"></span>
			<span class="toggle-label">${clickToOpenFile_i18n}</span>
		</label>
	</div>
	<h3 class="settings-title">${on_startup_i18n}</h3>
	<select name="on_startup">
		<option ${on_startup === 'new' ? 'selected' : ''} value="new">${newTab_i18n}</option>
		<option ${on_startup === 'continue' ? 'selected' : ''} value="continue">${continuePreviousSession_i18n}</option>
	</select>`;
	settingsMain.innerHTML = preferencePage;
	settingsMain.querySelector(`[name="language"]`).addEventListener('change', async (event: Event & { target: HTMLInputElement }) => {
		const preference = (await Storage.get('preference')) ?? {};
		preference.language = event.target.value;
		Storage.set('preference', preference);
		reload();

		document.querySelector('#sidebar-setting-btn-text').innerHTML = await Translate('Settings');
		Preference();
	});
	settingsMain.querySelector(`[name="hide-hidden-files"]`).addEventListener('change', async (event: Event & { target: HTMLInputElement }) => {
		const preference = (await Storage.get('preference')) ?? {};
		preference.hideHiddenFiles = event.target.checked;
		Storage.set('preference', preference);
		MAIN_BOX_ELEMENT().dataset.hideHiddenFiles = String(event.target.checked);
	});
	settingsMain.querySelector(`[name="hide-system-files"]`).addEventListener('change', async (event: Event & { target: HTMLInputElement }) => {
		const preference = (await Storage.get('preference')) ?? {};
		preference.hideSystemFiles = event.target.checked;
		Storage.set('preference', preference);
		reload();
	});
	settingsMain.querySelector(`[name="dirAlongsideFiles"]`).addEventListener('change', async (event: Event & { target: HTMLInputElement }) => {
		const preference = (await Storage.get('preference')) ?? {};
		preference.dirAlongsideFiles = event.target.checked;
		Storage.set('preference', preference);
		reload();
	});
	settingsMain.querySelector(`[name="detect-drive-change"]`).addEventListener('change', async (event: Event & { target: HTMLInputElement }) => {
		const preference = (await Storage.get('preference')) ?? {};
		preference.detectDriveChange = event.target.checked;
		Storage.set('preference', preference);
	});
	settingsMain
		.querySelector(`[name="automatically-change-preview-file"]`)
		.addEventListener('change', async (event: Event & { target: HTMLInputElement }) => {
			const preference = (await Storage.get('preference')) ?? {};
			preference.automaticallyChangePreviewFile = event.target.checked;
			Storage.set('preference', preference);
		});
	settingsMain
		.querySelector(`[name="calculate-subfolder-size"]`)
		.addEventListener('change', async (event: Event & { target: HTMLInputElement }) => {
			const preference = (await Storage.get('preference')) ?? {};
			console.log(event.target);
			preference.calculateSubFolderSize = event.target.checked;
			Storage.set('preference', preference);
			reload();
		});
	settingsMain.querySelector(`[name="click-to-open-sidebar"]`).addEventListener('change', async (event: Event & { target: HTMLInputElement }) => {
		const preference = (await Storage.get('preference')) ?? {};
		preference.clickToOpenSidebar = event.target.checked ? 'double' : 'single';
		Storage.set('preference', preference);
	});
	settingsMain.querySelector(`[name="click-to-open-home"]`).addEventListener('change', async (event: Event & { target: HTMLInputElement }) => {
		const preference = (await Storage.get('preference')) ?? {};
		preference.clickToOpenHome = event.target.checked ? 'double' : 'single';
		Storage.set('preference', preference);
	});
	settingsMain.querySelector(`[name="click-to-open-file"]`).addEventListener('change', async (event: Event & { target: HTMLInputElement }) => {
		const preference = (await Storage.get('preference')) ?? {};
		preference.clickToOpenFile = event.target.checked ? 'double' : 'single';
		Storage.set('preference', preference);
	});
	settingsMain.querySelector(`[name="on_startup"]`).addEventListener('change', async (event: Event & { target: HTMLInputElement }) => {
		const preference = (await Storage.get('preference')) ?? {};
		preference.on_startup = event.target.value;
		Storage.set('preference', preference);
		reload();
	});
};

export default Preference;
