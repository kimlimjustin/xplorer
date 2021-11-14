import { reload } from '../../Layout/windowManager';
import Translate from '../../I18n/i18n';
import Storage from '../../../Api/storage';
import OS from '../../../Api/platform';
let platform: string;
/**
 * Create appearence section
 * @returns {Promise<void>}
 */
const Appearance = async (): Promise<void> => {
	if (!platform) {
		platform = await OS();
	}
	const _theme = await Storage.get('theme');
	const _preference = await Storage.get('preference');
	const theme = _theme?.theme;
	const layout = _preference?.layout ?? 's';
	const videoAsThumbnail = _preference?.videoAsThumbnail ?? false;
	const imageAsThumbnail = _preference?.imageAsThumbnail ?? 'smalldir';
	const extractExeIcon = _preference?.extractExeIcon ?? false;
	const settingsMain = document.querySelector('.settings-main');
	const availableThemes = [
		{ name: 'Light', identifier: 'light', category: 'light' },
		{ name: 'Dark', identifier: 'dark', category: 'dark' },
		{ name: 'Light+', identifier: 'light+', category: 'light+' },
		{ name: 'Dark+', identifier: 'dark+', category: 'dark' },
	].concat(_theme?.availableThemes ?? []);
	const appTheme_i18n = await Translate('App Theme');
	const filePreview_i18n = await Translate('File Preview');
	const defaultFileLayout_i18n = await Translate('Default File Layout');
	const systemDefault_i18n = await Translate('System Default');
	const imageAsThumbnail_i18n = await Translate('Show image as thumbnail');
	const videoAsThumbnail_i18n = await Translate('Automatically play video file as thumbnail (May consume high amount of RAM)');
	const extractExeIcon_i18n = await Translate('Extract exe file icon and make it as the thumbnail (Turning it on might crashes Xplorer)');
	const appearancePage = `<h3 class="settings-title">${appTheme_i18n}</h3>
	<select name="theme">
		<option>${systemDefault_i18n}</option>
		${availableThemes.map((availableTheme) => {
			return `<option value="${availableTheme.identifier}" ${availableTheme.identifier === theme ? 'selected' : ''}>${
				availableTheme.name
			}</option>`;
		})}
	</select>
	<h3 class="settings-title">${filePreview_i18n}</h3>
	<div class="toggle-box">
		<label class="toggle">
			<input type="checkbox" name="preview-video" ${videoAsThumbnail ? 'checked' : ''}>
			<span class="toggle-slider"></span>
			<span class="toggle-label">${videoAsThumbnail_i18n}</span>
		</label>
	</div>
	${
		platform === 'win32'
			? `
				<div class="toggle-box">
					<label class="toggle">
						<input type="checkbox" name="extract-exe-icon" ${extractExeIcon ? 'checked' : ''}>
						<span class="toggle-slider"></span>
						<span class="toggle-label">${extractExeIcon_i18n}</span>
					</label>
				</div>
				`
			: ''
	}
	<h3 class="settings-title">${imageAsThumbnail_i18n}</h3>	
	<select name="imageAsThumbnail">
		<option ${imageAsThumbnail === 'no' ? 'selected' : ''} value="no">Disabled</option>
		<option ${imageAsThumbnail === 'smalldir' ? 'selected' : ''} value="smalldir">For small directory (recommended)</option>
		<option ${imageAsThumbnail === 'yes' ? 'selected' : ''} value="yes">Enable for all directory</option>
	</select>
	<h3 class="settings-title">${defaultFileLayout_i18n}</h3>
	<select name="layout">
		<option ${layout === 's' ? 'selected' : ''} value="s">Small Grid View</option>
		<option ${layout === 'm' ? 'selected' : ''} value="m">Medium Grid View</option>
		<option ${layout === 'l' ? 'selected' : ''} value="l">Large Grid View</option>
		<option ${layout === 'd' ? 'selected' : ''} value="d">Detail View</option>
	</select>`;
	settingsMain.innerHTML = appearancePage;
	settingsMain.querySelector('[name="theme"]')?.addEventListener('change', async (event: Event & { target: HTMLInputElement }) => {
		const category = (event.target as unknown as HTMLSelectElement).options[(event.target as unknown as HTMLSelectElement).selectedIndex].dataset
			.category;
		const themes = await Storage.get('theme');
		themes['theme'] = event.target.value;
		themes['category'] = category;
		Storage.set('theme', themes);
		reload();
	});
	settingsMain.querySelector('[name="layout"]')?.addEventListener('change', (event: Event & { target: HTMLInputElement }) => {
		const preference = _preference ?? {};
		preference.layout = event.target.value;
		Storage.set('preference', preference);
		reload();
	});
	settingsMain.querySelector(`[name="preview-video"]`)?.addEventListener('change', (event: Event & { target: HTMLInputElement }) => {
		const preference = _preference ?? {};
		preference.videoAsThumbnail = event.target.checked;
		Storage.set('preference', preference);
		reload();
	});
	settingsMain.querySelector(`[name="extract-exe-icon"]`)?.addEventListener('change', (event: Event & { target: HTMLInputElement }) => {
		const preference = _preference ?? {};
		preference.extractExeIcon = event.target.checked;
		Storage.set('preference', preference);
		reload();
	});
	settingsMain.querySelector('[name="imageAsThumbnail"]')?.addEventListener('change', (event: Event & { target: HTMLInputElement }) => {
		const preference = _preference ?? {};
		preference.imageAsThumbnail = event.target.value;
		Storage.set('preference', preference);
		reload();
	});
};

export default Appearance;
