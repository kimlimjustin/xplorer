import { reload, minimize, maximize, close } from '../../Layout/windowManager';
import Translate from '../../I18n/i18n';
import Storage from '../../../Service/storage';
import OS, { isWin11 } from '../../../Service/platform';
import { changeTransparentEffect, getAvailableFonts, enableShadowEffect } from '../../../Service/app';
import { getElementStyle, getInstalledThemes, updateTheme } from '../../Theme/theme';
import { setDecorations } from '../../../Service/window';
import Infobar from '../../Layout/infobar';
import isTauri from '../../../Util/is-tauri';
let platform: string;
/**
 * Create appearence section
 * @returns {Promise<void>}
 */
const Appearance = async (): Promise<void> => {
	if (!platform) {
		platform = await OS();
	}
	const developingTheme = document.body.dataset.usingCustomTheme === 'true';
	const _theme = await Storage.get('theme');
	const _appearance = await Storage.get('appearance');
	const theme = _theme?.theme;
	const shadowEffect = _appearance?.shadowEffect ?? true;
	const layout = _appearance?.layout ?? 's';
	const videoAsThumbnail = _appearance?.videoAsThumbnail ?? false;
	const imageAsThumbnail = _appearance?.imageAsThumbnail ?? 'smalldir';
	const extractExeIcon = _appearance?.extractExeIcon ?? false;
	const previewImageOnHover = _appearance?.previewImageOnHover ?? true;
	const settingsMain = document.querySelector('.settings-main');
	const fontFamily = _appearance?.fontFamily ?? getElementStyle('fontFamily');
	const fontSize = parseInt(_appearance?.fontSize ?? 16);
	const windowTransparency = parseInt(_appearance?.windowTransparency ?? 80);
	const transparentEffect = _appearance?.transparentEffect ?? 'none';
	const transparentSidebar = _appearance?.transparentSidebar ?? true;
	const transparentTopbar = _appearance?.transparentTopbar ?? false;
	const transparentWorkspace = _appearance?.transparentWorkspace ?? false;
	const frameStyle = _appearance?.frameStyle ?? 'default';
	const showInfoBar = _appearance?.showInfoBar ?? true;

	const installedThemes = await getInstalledThemes();
	const availableThemes = [
		{ name: 'Light', identifier: 'light' },
		{ name: 'Dark', identifier: 'dark' },
		{ name: 'Light+', identifier: 'light+' },
		{ name: 'Dark+', identifier: 'dark+' },
	].concat(...installedThemes.map((theme) => [{ name: theme.name, identifier: theme.identifier }]));
	const availableFonts = await getAvailableFonts();
	const default_i18n = await Translate('Default');
	const appTheme_i18n = await Translate('App Theme');
	const shadowEffect_i18n = await Translate('Apply Shadow Effect');
	const filePreview_i18n = await Translate('File Preview');
	const defaultFileLayout_i18n = await Translate('Default File Layout');
	const gridViewSmall_i18n = await Translate('Grid View (Small)');
	const gridViewMedium_i18n = await Translate('Grid View (Medium)');
	const gridViewLarge_i18n = await Translate('Grid View (Large)');
	const detailView_i18n = await Translate('Detail View');
	const systemDefault_i18n = await Translate('System Default');
	const imageAsThumbnail_i18n = await Translate('Show image as thumbnail');
	const disabled_i18n = await Translate('Disabled');
	const forSmallDirectory_i18n = await Translate('For small directory (recommended)');
	const enableForAllDirectory_i18n = await Translate('Enable for all directory');
	const videoAsThumbnail_i18n = await Translate('Automatically play video file as thumbnail (May consume high amount of RAM)');
	const extractExeIcon_i18n = await Translate('Extract exe file icon and make it as the thumbnail (Turning it on might crashes Xplorer)');
	const previewImageOnHover_i18n = await Translate('Preview image on hover');
	const fontFamily_i18n = await Translate('Font Family');
	const fontSize_i18n = await Translate('Font Size');
	const windowTransparency_i18n = await Translate('Window Transparency');
	const transparentEffect_i18n = await Translate('Transparent Effect');
	const blur_i18n = await Translate('Blur');
	const acrylic_i18n = await Translate('Acrylic');
	const mica_i18n = await Translate('Mica');
	const vibrancy_i18n = await Translate('Vibrancy');
	const none_i18n = await Translate('None');
	const transparentSidebar_i18n = await Translate('Transparent Sidebar');
	const transparentTopbar_i18n = await Translate('Transparent Topbar');
	const transparentWorkspace_i18n = await Translate('Transparent Workspace');
	const frameStyle_i18n = await Translate('Frame Style');
	const workspace_i18n = await Translate('Workspace');
	const showInfoBar_i18n = await Translate('Show Info Bar');
	const disabledForWeb = !isTauri ? 'disabled' : '';
	const appearancePage = `<h3 class="settings-title">${appTheme_i18n}</h3>
	<select name="theme">
		<option  ${developingTheme ? 'disabled' : ''}>${systemDefault_i18n}</option>
		${developingTheme ? '<option selected>Dev mode</option>' : ''}
		${availableThemes.map((availableTheme) => {
			return `<option value="${availableTheme.identifier}" ${availableTheme.identifier === theme && !developingTheme ? 'selected' : ''} ${
				developingTheme ? 'disabled' : ''
			}>${availableTheme.name}</option>`;
		})}
	</select>
	${
		platform !== 'linux'
			? `<div class="toggle-box">
		<label class="toggle">
			<input type="checkbox" name="shadow-effect" ${shadowEffect ? 'checked' : ''} ${disabledForWeb}>
			<span class="toggle-slider"></span>
			<span class="toggle-label">${shadowEffect_i18n}</span>
		</label>
	</div>`
			: ''
	}
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
		<input type="range" value="${windowTransparency}" min="5" max="100" class="transparency-slider" ${disabledForWeb}>
	</div>
	<div class="toggle-box">
		<label class="toggle">
			<input type="checkbox" name="transparent-sidebar" ${transparentSidebar ? 'checked' : ''} ${disabledForWeb}>
			<span class="toggle-slider"></span>
			<span class="toggle-label">${transparentSidebar_i18n}</span>
		</label>
	</div>
	<div class="toggle-box">
		<label class="toggle">
			<input type="checkbox" name="transparent-topbar" ${transparentTopbar ? 'checked' : ''} ${disabledForWeb}>
			<span class="toggle-slider"></span>
			<span class="toggle-label">${transparentTopbar_i18n}</span>
		</label>
	</div>
	<div class="toggle-box">
		<label class="toggle">
			<input type="checkbox" name="transparent-workspace" ${transparentWorkspace ? 'checked' : ''} ${disabledForWeb}>
			<span class="toggle-slider"></span>
			<span class="toggle-label">${transparentWorkspace_i18n}</span>
		</label>
	</div>
	<h3 class="settings-title">${transparentEffect_i18n}</h3>
	<select name="transparent-effect">
		<option value="blur" ${transparentEffect === 'blur' ? 'selected' : ''} ${platform !== 'win32' ? 'disabled' : ''} ${disabledForWeb}>${blur_i18n}</option>
		<option value="acrylic" ${transparentEffect === 'acrylic' ? 'selected' : ''} ${platform !== 'win32' ? 'disabled' : ''
		} ${disabledForWeb}>${acrylic_i18n}</option>
		<option value="mica" ${transparentEffect === 'mica' ? 'selected' : ''} ${!(platform === 'win32' && (await isWin11())) ? 'disabled' : ''
		} ${disabledForWeb}>${mica_i18n}</option>
		<option value="vibrancy" ${transparentEffect === 'vibrancy' ? 'selected' : ''} ${platform !== 'darwin' ? 'disabled' : ''
		} ${disabledForWeb}>${vibrancy_i18n}</option>
		<option value="none" ${transparentEffect === 'none' ? 'selected' : ''}>${none_i18n}</option>
	</select>
	<h3 class="settings-title">${frameStyle_i18n}</h3>
	<select name="frame-style">
		<option value="default" ${frameStyle === 'default' ? 'selected' : ''} ${disabledForWeb}>${default_i18n}</option>
		<option value="os" ${frameStyle === 'os' ? 'selected' : ''} ${disabledForWeb}>${systemDefault_i18n}</option>
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
		<option ${imageAsThumbnail === 'no' ? 'selected' : ''} value="no">${disabled_i18n}</option>
		<option ${imageAsThumbnail === 'smalldir' ? 'selected' : ''} value="smalldir">${forSmallDirectory_i18n}</option>
		<option ${imageAsThumbnail === 'yes' ? 'selected' : ''} value="yes">${enableForAllDirectory_i18n}</option>
	</select>
	<h3 class="settings-title">${defaultFileLayout_i18n}</h3>
	<select name="layout">
		<option ${layout === 's' ? 'selected' : ''} value="s">${gridViewSmall_i18n}</option>
		<option ${layout === 'm' ? 'selected' : ''} value="m">${gridViewMedium_i18n}</option>
		<option ${layout === 'l' ? 'selected' : ''} value="l">${gridViewLarge_i18n}</option>
		<option ${layout === 'd' ? 'selected' : ''} value="d">${detailView_i18n}</option>
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
	settingsMain.querySelector('[name="shadow-effect"]')?.addEventListener('change', (event: Event & { target: HTMLInputElement }) => {
		const shadowEffect = event.target.checked;
		const appearance = _appearance ?? {};
		appearance.shadowEffect = shadowEffect;
		enableShadowEffect(shadowEffect);
		Storage.set('appearance', appearance);
	});
	settingsMain.querySelectorAll('.number-ctrl').forEach((ctrl) => {
		const number = ctrl.querySelector<HTMLInputElement>('.number-ctrl-input');
		ctrl.querySelector('.number-ctrl-minus').addEventListener('click', () => {
			number.value = +number.value - 1 + '';
			const appearance = _appearance ?? {};
			appearance.fontSize = `${number.value}px`;
			document.body.style.fontSize = `${number.value}px`;
			document.documentElement.style.fontSize = `${number.value}px`;
			Storage.set('appearance', appearance);
		});
		ctrl.querySelector('.number-ctrl-plus').addEventListener('click', () => {
			number.value = +number.value + 1 + '';
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
			document.body.style.setProperty('--sidebar-transparency', '1');
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
			document.body.style.setProperty('--workspace-transparency', '1');
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
			document.body.style.setProperty('--topbar-transparency', '1');
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
		const themes = (await Storage.get('theme')) ?? {};
		themes['theme'] = event.target.value;
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
