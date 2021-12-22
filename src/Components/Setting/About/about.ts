import { getTauriVersion } from '@tauri-apps/api/app';
import { version, description } from '../../../../package.json';
import { os } from '@tauri-apps/api';

// Copy text into clipboard
const copyToClipboard = (text: string) => {
	return `navigator.clipboard.writeText('${text}')`;
};
/**
 * Create about section
 * @returns {Promise<void>}
 */
const About = async (): Promise<void> => {
	const settingsMain = document.querySelector('.settings-main');
	const tauriVersion = await getTauriVersion();
	const platform = await os.platform();
	const arch = await os.arch();
	const osVersion = await os.version();
	const aboutPage = `
	<div class="settings-about">
	<div class="settings-about-header">
		<img src="${await require('../../../Icon/icon.png')}" />
		<h1>Xplorer</h1>
		<span class="settings-about-caption">${description}</span>
	</div>
	<div class="settings-about-content">
		<ul>
			<li>
				<span>Version: </span><span>${version}</span
				><span
					data-tooltip="Copy"
					onClick="${copyToClipboard('Version: ' + version)}"
					>&#x2398;</span
				>
			</li>
			<li>
				<span>Tauri version: </span><span>${tauriVersion}</span
				><span
					data-tooltip="Copy"
					onClick="${copyToClipboard('Tauri version: ' + tauriVersion)}"
					>&#x2398;</span
				>
			</li>
			<li>
				<span>OS: </span><span>${platform} ${arch} ${osVersion}</span
				><span
					data-tooltip="Copy"
					onClick="${copyToClipboard('OS: ' + platform + ' ' + arch + ' ' + osVersion)}"
					>&#x2398;</span
				>
			</li>
		</ul>
	</div>
	<div class="settings-about-footer">
		<a
			class="settings-about-link-btn"
			href="https://github.com/kimlimjustin/xplorer"
			target="_blank"
			>GitHub</a
		>
		<a
			class="settings-about-link-btn"
			href="https://xplorer.space"
			target="_blank"
			>Documentation</a
		>
		<a
			class="settings-about-link-btn"
			href="https://github.com/kimlimjustin/xplorer/blob/master/LICENSE"
			target="_blank"
			>License</a
		>
		<a
			class="settings-about-link-btn"
			href="https://github.com/kimlimjustin/xplorer/graphs/contributors"
			target="_blank"
			>Contributors</a
		>
	</div>
</div>
`;
	settingsMain.innerHTML = aboutPage;
};
export default About;
