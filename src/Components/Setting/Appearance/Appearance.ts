import { ipcRenderer } from 'electron';
import ejs from 'ejs';
import storage from 'electron-json-storage-sync';
import path from 'path';
import { reload } from '../../Layout/windowManager';

/**
 * Create appearence section
 * @returns {void}
 */
const Appearance = (): void => {
	const theme = storage.get('theme')?.data?.theme;
	const acrylic = storage.get('theme')?.data?.acrylic ?? true;
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
	];
	ejs.renderFile(path.join(__dirname, 'appearance.ejs'), {
		theme,
		acrylicEnabled: acrylic,
		autoPlayPreviewVideo,
		extractExeIcon,
		availableThemes,
		layout,
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
					storage.set('theme', {
						theme: event.target.value,
						category: category,
						acrylic:
							document.querySelector<HTMLInputElement>(
								'[name="acrylic"]'
							)?.checked ?? true,
					});
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
