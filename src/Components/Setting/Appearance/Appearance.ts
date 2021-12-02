import { reload, minimize, maximize, close } from '../../Layout/windowManager';
import Translate from '../../I18n/i18n';
import Storage from '../../../Api/storage';
import OS from '../../../Api/platform';
import { changeTransparentEffect, getAvailableFonts } from '../../../Api/app';
import { getElementStyle, updateTheme } from '../../Theme/theme';
import { setDecorations } from '../../../Api/window';
import Infobar from '../../Layout/infobar';
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
	const _appearance = await Storage.get('appearance');
	const theme = _theme?.theme;
	const layout = _appearance?.layout ?? 's';
	const videoAsThumbnail = _appearance?.videoAsThumbnail ?? false;
	const imageAsThumbnail = _appearance?.imageAsThumbnail ?? 'smalldir';
	const extractExeIcon = _appearance?.extractExeIcon ?? false;
	const previewImageOnHover = _appearance?.previewImageOnHover ?? true;
	const settingsMain = document.querySelector('.settings-main');
	const fontFamily = _appearance?.fontFamily ?? getElementStyle('fontFamily');
	const fontSize = parseInt(_appearance?.fontSize ?? getElementStyle('fontSize'));
	const windowTransparency = parseInt(_appearance?.windowTransparency ?? 80);
	const transparentEffect = _appearance?.transparentEffect ?? 'blur';
	const transparentSidebar = _appearance?.transparentSidebar ?? true;
	const transparentTopbar = _appearance?.transparentTopbar ?? false;
	const transparentWorkspace = _appearance?.transparentWorkspace ?? false;
	const frameStyle = _appearance?.frameStyle ?? 'default';
	const showInfoBar = _appearance?.showInfoBar ?? true;

	const availableThemes = [
		{ name: 'Light', identifier: 'light', category: 'light' },
		{ name: 'Dark', identifier: 'dark', category: 'dark' },
		{ name: 'Light+', identifier: 'light+', category: 'light+' },
		{ name: 'Dark+', identifier: 'dark+', category: 'dark' },
	].concat(_theme?.availableThemes ?? []);
	const availableFonts = await getAvailableFonts();
	const default_i18n = await Translate('Default');
	const appTheme_i18n = await Translate('App Theme');
	const filePreview_i18n = await Translate('File Preview');
	const defaultFileLayout_i18n = await Translate('Default File Layout');
	const systemDefault_i18n = await Translate('System Default');
	const imageAsThumbnail_i18n = await Translate('Show image as thumbnail');
	const videoAsThumbnail_i18n = await Translate('Automatically play video file as thumbnail (May consume high amount of RAM)');
	const extractExeIcon_i18n = await Translate('Extract exe file icon and make it as the thumbnail (Turning it on might crashes Xplorer)');
	const previewImageOnHover_i18n = await Translate('Preview image on hover');
	const fontFamily_i18n = await Translate('Font Family');
	const fontSize_i18n = await Translate('Font Size');
	const windowTransparency_i18n = await Translate('Window Transparency');
	const transparentEffect_i18n = await Translate('Transparent Effect');
	const transparentSidebar_i18n = await Translate('Transparent Sidebar');
	const transparentTopbar_i18n = await Translate('Transparent Topbar');
	const transparentWorkspace_i18n = await Translate('Transparent Workspace');
	const frameStyle_i18n = await Translate('Frame Style');
	const workspace_i18n = await Translate('Workspace');
	const showInfoBar_i18n = await Translate('Show Info Bar');
	const appearancePage = `<h3 class="settings-title">${appTheme_i18n}</h3>
	<select name="theme">
		<option>${systemDefault_i18n}</option>
		${availableThemes.map((availableTheme) => {
			return `<option value="${availableTheme.identifier}" ${availableTheme.identifier === theme ? 'selected' : ''}>${
				availableTheme.name
			}</option>`;
		})}
	</select>
	<h3 class="settings-title">${fontFamily_i18n}</h3>
	<select name="font">
		<option value="${fontFamily}" selected>${fontFamily ?? systemDefault_i18n}</option>
		${availableFonts.map((availableFont) => {
			if (availableFont !== fontFamily)
				return `<option value="${availableFont}" style="font-family: ${availableFont};">${availableFont}</option>`;
		})}
	</select>
	<h3 class="settings-title">${fontSize_i18n}</h3>
	<div class="number-ctrl">
		<div class="number-ctrl-minus">-</div>
		<input type="number" name="fontSize" value="${fontSize}" step="1" class="number-ctrl-input">
		<div class="number-ctrl-plus">+</div>
	</div>
	<h3 class="settings-title">${windowTransparency_i18n}: <span id='transparency-label'>${windowTransparency}</span>%</h3>
		<input type="range" value="${windowTransparency}" min="5" max="100" class="transparency-slider">
	</div>
	<div class="toggle-box">
		<label class="toggle">
			<input type="checkbox" name="transparent-sidebar" ${transparentSidebar ? 'checked' : ''}>
			<span class="toggle-slider"></span>
			<span class="toggle-label">${transparentSidebar_i18n}</span>
		</label>
	</div>
	<div class="toggle-box">
		<label class="toggle">
			<input type="checkbox" name="transparent-topbar" ${transparentTopbar ? 'checked' : ''}>
			<span class="toggle-slider"></span>
			<span class="toggle-label">${transparentTopbar_i18n}</span>
		</label>
	</div>
	<div class="toggle-box">
		<label class="toggle">
			<input type="checkbox" name="transparent-workspace" ${transparentWorkspace ? 'checked' : ''}>
			<span class="toggle-slider"></span>
			<span class="toggle-label">${transparentWorkspace_i18n}</span>
		</label>
	</div>
	<h3 class="settings-title">${transparentEffect_i18n}</h3>
	<select name="transparent-effect">
		<option value="blur" ${transparentEffect === 'blur' ? 'selected' : ''}>Blur</option>
		<option value="acrylic" ${transparentEffect === 'acrylic' ? 'selected' : ''}>Acrylic</option>
		<option value="none" ${transparentEffect === 'none' ? 'selected' : ''}>None</option>
	</select>
	<h3 class="settings-title">${frameStyle_i18n}</h3>
	<select name="frame-style">
		<option value="default" ${frameStyle === 'default' ? 'selected' : ''}>${default_i18n}</option>
		<option value="os" ${frameStyle === 'os' ? 'selected' : ''}>${systemDefault_i18n}</option>
	</select>
	<h3 class="settings-title">${filePreview_i18n}</h3>
	<div class="toggle-box">
		<label class="toggle">
			<input type="checkbox" name="preview-video" ${videoAsThumbnail ? 'checked' : ''}>
			<span class="toggle-slider"></span>
			<span class="toggle-label">${videoAsThumbnail_i18n}</span>
		</label>
	</div>
	<div class="toggle-box">
		<label class="toggle">
			<input type="checkbox" name="preview-image-on-hover" ${previewImageOnHover ? 'checked' : ''}>
			<span class="toggle-slider"></span>
			<span class="toggle-label">${previewImageOnHover_i18n}</span>
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
	</select>
	<h3 class="settings-title">${workspace_i18n}</h3>
	<div class="toggle-box">
		<label class="toggle">
			<input type="checkbox" name="show-info-bar" ${showInfoBar ? 'checked' : ''}>
			<span class="toggle-slider"></span>
			<span class="toggle-label">${showInfoBar_i18n}</span>
		</label>
	</div>
	`;
	settingsMain.innerHTML = appearancePage;
	updateTheme('settings');
	settingsMain.querySelectorAll('.number-ctrl').forEach((ctrl) => {
		const number = ctrl.querySelector<HTMLInputElement>('.number-ctrl-input');
		ctrl.querySelector('.number-ctrl-minus').addEventListener('click', () => {
			number.value = (parseInt(number.value) - 1).toString();
			const appearance = _appearance ?? {};
			appearance.fontSize = `${number.value}px`;
			document.body.style.fontSize = `${number.value}px`;
			document.documentElement.style.fontSize = `${number.value}px`;
			Storage.set('appearance', appearance);
		});
		ctrl.querySelector('.number-ctrl-plus').addEventListener('click', () => {
			number.value = (parseInt(number.value) + 1).toString();
			const appearance = _appearance ?? {};
			appearance.fontSize = `${number.value}px`;
			document.body.style.fontSize = `${number.value}px`;
			document.documentElement.style.fontSize = `${number.value}px`;
			Storage.set('appearance', appearance);
		});
	});
	settingsMain.querySelector('.transparency-slider').addEventListener('input', (event: Event & { target: HTMLInputElement }) => {
		const value = parseInt(event.target.value);
		const appearance = _appearance ?? {};
		appearance.windowTransparency = `${value}%`;
		document.getElementById('transparency-label').innerHTML = String(value);
		if (appearance?.transparentSidebar ?? true)
			document.body.style.setProperty('--sidebar-transparency', appearance?.windowTransparency ?? '0.8');
		if (appearance?.transparentWorkspace ?? false)
			document.body.style.setProperty('--workspace-transparency', appearance?.windowTransparency ?? '0.8');
		if (appearance?.transparentTopbar ?? false) document.body.style.setProperty('--topbar-transparency', appearance?.windowTransparency ?? '0.8');
		Storage.set('appearance', appearance);
	});
	settingsMain.querySelector('[name="transparent-sidebar"]').addEventListener('change', (event: Event & { target: HTMLInputElement }) => {
		const value = event.target.checked;
		const appearance = _appearance ?? {};
		appearance.transparentSidebar = value;
		if (value) {
			document.body.style.setProperty('--sidebar-transparency', appearance?.windowTransparency ?? '0.8');
		} else {
			document.body.style.removeProperty('--sidebar-transparency');
		}
		Storage.set('appearance', appearance);
	});
	settingsMain.querySelector('[name="transparent-workspace"]').addEventListener('change', (event: Event & { target: HTMLInputElement }) => {
		const value = event.target.checked;
		const appearance = _appearance ?? {};
		appearance.transparentWorkspace = value;
		if (value) {
			document.body.style.setProperty('--workspace-transparency', appearance?.windowTransparency ?? '0.8');
		} else {
			document.body.style.removeProperty('--workspace-transparency');
		}
		Storage.set('appearance', appearance);
	});
	settingsMain.querySelector('[name="transparent-topbar"]').addEventListener('change', (event: Event & { target: HTMLInputElement }) => {
		const value = event.target.checked;
		const appearance = _appearance ?? {};
		appearance.transparentTopbar = value;
		if (value) {
			document.body.style.setProperty('--topbar-transparency', appearance?.windowTransparency ?? '0.8');
		} else {
			document.body.style.removeProperty('--topbar-transparency');
		}
		Storage.set('appearance', appearance);
	});
	settingsMain.querySelector('[name="transparent-effect"]').addEventListener('change', (event: Event & { target: HTMLInputElement }) => {
		const appearance = _appearance ?? {};
		appearance.transparentEffect = event.target.value;
		changeTransparentEffect(appearance.transparentEffect);
		Storage.set('appearance', appearance);
	});
	settingsMain.querySelector('[name="frame-style"]').addEventListener('change', (event: Event & { target: HTMLInputElement }) => {
		const value = event.target.value;
		const appearance = _appearance ?? {};
		appearance.frameStyle = value;
		setDecorations(value === 'os');
		if (value === 'os') {
			document.querySelector('.window-manager').parentNode.removeChild(document.querySelector('.window-manager'));
		} else {
			const windowManager = document.createElement('div');
			windowManager.classList.add('window-manager');
			windowManager.innerHTML = `<span id="minimize" title="Minimize"></span>
			<span id="maximize" title="Maximize"></span>
			<span id="exit" title="Exit (Ctrl + w)"></span>`;
			document.querySelector('.tabs-manager').appendChild(windowManager);
			updateTheme('windowmanager');
			// Minimize the screen
			windowManager.querySelector('#minimize').addEventListener('click', minimize);
			// Maximize the screen
			windowManager.querySelector('#maximize').addEventListener('click', maximize);
			// Exit window
			windowManager.querySelector('#exit').addEventListener('click', close);
		}
		Storage.set('appearance', appearance);
	});
	settingsMain.querySelector('[name="fontSize"]')?.addEventListener('input', (event: Event & { target: HTMLInputElement }) => {
		const appearance = _appearance ?? {};
		appearance.fontSize = `${event.target.value}px`;
		document.body.style.fontSize = `${event.target.value}px`;
		document.documentElement.style.fontSize = `${parseInt(event.target.value)}px`;
		Storage.set('appearance', appearance);
	});
	settingsMain.querySelector('[name="theme"]')?.addEventListener('change', async (event: Event & { target: HTMLInputElement }) => {
		const category = (event.target as unknown as HTMLSelectElement).options[(event.target as unknown as HTMLSelectElement).selectedIndex].dataset
			.category;
		const themes = await Storage.get('theme');
		themes['theme'] = event.target.value;
		themes['category'] = category;
		Storage.set('theme', themes);
		updateTheme('*');
	});
	settingsMain.querySelector('[name="font"]')?.addEventListener('change', (event: Event & { target: HTMLInputElement }) => {
		const appearance = _appearance ?? {};
		appearance.fontFamily = event.target.value;
		document.body.style.fontFamily = appearance.fontFamily;
		Storage.set('appearance', appearance);
	});
	settingsMain.querySelector('[name="layout"]')?.addEventListener('change', (event: Event & { target: HTMLInputElement }) => {
		const appearance = _appearance ?? {};
		appearance.layout = event.target.value;
		Storage.set('appearance', appearance);
		reload();
	});
	settingsMain.querySelector(`[name="preview-video"]`)?.addEventListener('change', (event: Event & { target: HTMLInputElement }) => {
		const appearance = _appearance ?? {};
		appearance.videoAsThumbnail = event.target.checked;
		Storage.set('appearance', appearance);
		reload();
	});
	settingsMain.querySelector(`[name="preview-image-on-hover"]`)?.addEventListener('change', (event: Event & { target: HTMLInputElement }) => {
		const appearance = _appearance ?? {};
		appearance.previewImageOnHover = event.target.checked;
		Storage.set('appearance', appearance);
		reload();
	});
	settingsMain.querySelector(`[name="extract-exe-icon"]`)?.addEventListener('change', (event: Event & { target: HTMLInputElement }) => {
		const appearance = _appearance ?? {};
		appearance.extractExeIcon = event.target.checked;
		Storage.set('appearance', appearance);
		reload();
	});
	settingsMain.querySelector('[name="imageAsThumbnail"]')?.addEventListener('change', (event: Event & { target: HTMLInputElement }) => {
		const appearance = _appearance ?? {};
		appearance.imageAsThumbnail = event.target.value;
		Storage.set('appearance', appearance);
		reload();
	});
	settingsMain.querySelector('[name="show-info-bar"]').addEventListener('change', (event: Event & { target: HTMLInputElement }) => {
		const value = event.target.checked;
		const appearance = _appearance ?? {};
		appearance.showInfoBar = value;
		Storage.set('appearance', appearance);
		if (value) {
			Infobar();
			reload();
		} else {
			document.getElementById('infobar')?.parentNode?.removeChild?.(document.getElementById('infobar'));
		}
	});
};

export default Appearance;
