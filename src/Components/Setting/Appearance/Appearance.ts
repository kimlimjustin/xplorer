import { ipcRenderer } from 'electron';
import ejs from 'ejs';
import storage from 'electron-json-storage-sync';
import path from 'path';
import { reload } from '../../Layout/windowManager';
import Translate from '../../I18n/i18n';

/**
 * Create appearence section
 * @returns {void}
 */
const Appearance = (): void => {
	const theme = storage.get('theme')?.data?.theme;
	const acrylicEnabled = storage.get('theme')?.data?.acrylic ?? true;
	const layout = storage.get('preference')?.data?.layout ?? 's';
	const autoPlayPreviewVideo =
		storage.get('preference')?.data?.autoPlayPreviewVideo;
	const extractExeIcon =
		storage.get('preference')?.data?.extractExeIcon ?? true;
	const settingsMain = document.querySelector('.settings-main');
	const availableThemes = [
		{ name: 'Light', identifier: 'light', category: 'light' },
		{ name: 'Dark', identifier: 'dark', category: 'dark' },
		{ name: 'Light+', identifier: 'light+', category: 'light+' },
		{ name: 'Dark+', identifier: 'dark+', category: 'dark' },
	].concat(storage.get('theme')?.data?.availableThemes ?? []);
	const appTheme_i18n = Translate('App Theme');
	const systemDefault_i18n = Translate('System Default');
	const acrylicEffect_i18n = Translate('Acrylic Effect');
	const autoPlayPreviewVideo_i18n = Translate(
		'Auto play video file as thumbnail (May consume high amount of RAM)'
	);
	const extractExeIcon_i18n = Translate(
		'Extract exe file icon and make it as thumbnail'
	);
	ejs.renderFile(path.join(__dirname, 'appearance.ejs'), {
		theme,
		acrylicEnabled,
		autoPlayPreviewVideo,
		extractExeIcon,
		availableThemes,
		layout,
		appTheme_i18n,
		systemDefault_i18n,
		acrylicEffect_i18n,
		autoPlayPreviewVideo_i18n,
		extractExeIcon_i18n,
	}).then((result) => {
		settingsMain.innerHTML = result;
		settingsMain
			.querySelector('[name="theme"]')
			?.addEventListener(
				'change',
				(event: Event & { target: HTMLInputElement }) => {
					const category = (
						event.target as unknown as HTMLSelectElement
					).options[
						(event.target as unknown as HTMLSelectElement)
							.selectedIndex
					].dataset.category;
					const themes = storage.get('theme')?.data;
					themes['theme'] = event.target.value;
					themes['category'] = category;
					storage.set('theme', themes);
					ipcRenderer.send('update-theme');
					reload();
				}
			);
		settingsMain
			.querySelector('[name="layout"]')
			?.addEventListener(
				'change',
				(event: Event & { target: HTMLInputElement }) => {
					const preference = storage.get('preference')?.data ?? {};
					preference.layout = event.target.value;
					storage.set('preference', preference);
				}
			);
		settingsMain
			.querySelector(`[name="preview-video"]`)
			?.addEventListener(
				'change',
				(event: Event & { target: HTMLInputElement }) => {
					const preference = storage.get('preference')?.data ?? {};
					preference.autoPlayPreviewVideo = event.target.checked;
					storage.set('preference', preference);
					reload();
				}
			);
		settingsMain
			.querySelector(`[name="extract-exe-icon"]`)
			?.addEventListener(
				'change',
				(event: Event & { target: HTMLInputElement }) => {
					const preference = storage.get('preference')?.data ?? {};
					preference.extractExeIcon = event.target.checked;
					storage.set('preference', preference);
					reload();
				}
			);
		settingsMain
			.querySelector(`[name="acrylic"]`)
			?.addEventListener(
				'change',
				(event: Event & { target: HTMLInputElement }) => {
					const theme = storage.get('theme')?.data;
					theme.acrylic = event.target.checked;
					storage.set('theme', theme);
					reload();
				}
			);
	});
};

export default Appearance;
