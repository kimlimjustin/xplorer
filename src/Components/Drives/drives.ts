import formatBytes from '../Functions/filesize';
import Translate from '../I18n/i18n';
import fileThumbnail from '../Thumbnail/thumbnail';
import { updateTheme } from '../Theme/theme';
import DrivesAPI, { Drive } from '../../Service/drives';
import OS from '../../Service/platform';
import Storage from '../../Service/storage';
// Initialize values
let platform: string;
let driveInfo: DrivesAPI;
(async () => {
	if (!platform) {
		platform = await OS();
	}
	if (!driveInfo) {
		driveInfo = new DrivesAPI();
		driveInfo.build();
	}
})();

/**
 * Function to convert drives into HTML Tags
 * @param {Array} drives - Array of drives
 * @returns {Promise<string>} Result
 */
const drivesToElements = async (drives: Drive[]): Promise<string> => {
	let result = drives.length ? `<h1 class="section-title">${await Translate(platform === 'linux' ? 'Pendrives' : 'Drives')}</h1>` : ''; // Element Result
	for (const drive of drives) {
		const driveName = drive.mount_point.split('/')[drive.mount_point.split('/').length - 1]; // Get name of drive
		result += `
        <div class="pendrive file card-hover-effect" data-isdir="true" data-path = "${encodeURI(drive.mount_point)}">
            <img src="${await fileThumbnail(drive.is_removable ? 'usb' : 'hard-disk', 'favorites', false)}" alt="USB icon" class="pendrive-icon">
            <div class="pendrive-info">
                ${
					drive.name ?? drive.disk_type
						? `<h4 class="pendrive-title">${drive.name && /[^?]/.test(drive.name) ? drive.name : drive.disk_type} (${driveName})</h4>` //eslint-disable-line
						: `<h4 class="pendrive-title">${driveName}</h4>`
				}
                <div class="pendrive-total-capacity"><span class="pendrive-used-capacity" style="width: ${
					((drive.total_space - drive.available_space) / drive.total_space) * 100 + '%'
				}"></span></div>
                <p>${formatBytes(drive.available_space)} ${await Translate('free of')} ${formatBytes(drive.total_space)}</p>
            </div>
        </div>
        `;
	}
	return result;
};

/**
 * Create drives elements
 * @returns {Promise<string>} drive section HTML code
 */
const Drives = async (): Promise<string> => {
	//if (focusingPath() === 'xplorer://Home') {
	switch (platform) {
		case 'darwin':
			return ''; // Xplorer does not support drives for macOS currently
		case 'win32':
		default:
			return `<section class="home-section" id="drives">${await drivesToElements(driveInfo.DRIVES)}</section>`;
	}
	//} else return '';
};

/**
 * Write drive items to sidebar's dropdown list
 * @returns {Promise<void>}
 */
const writeSidebarDriveItems = async (): Promise<void> => {
	const drives = driveInfo.DRIVES;
	const isWin32 = platform === 'win32';
	const driveElement = document.querySelector<HTMLElement>('#sidebar-drives');
	const driveBtnText = driveElement.querySelector('.sidebar-text');
	driveBtnText.textContent = await Translate(isWin32 ? 'Drives' : 'Pendrives');
	if (!drives.length || platform === 'darwin') {
		driveElement.hidden = true;
		return;
	}
	let content = '';
	for (const drive of drives) {
		let driveName: string;
		if (platform === 'win32') {
			const hasName = drive.name && /[^?]/.test(drive.name);
			driveName = hasName ? drive.name : drive.disk_type;
			driveName += ' (' + drive.mount_point.replace(/\\$/g, '') + ')';
		} else driveName = drive.mount_point.split('/').at(-1);
		const driveType = drive.is_removable ? 'usb' : 'hard-disk';
		const iconPath = await fileThumbnail(driveType, 'favorites', false);
		content +=
			`<span data-path="${encodeURI(drive.mount_point)}" data-isdir="true" class="sidebar-hover-effect sidebar-nav-item drive-item">\n` +
			`  <div class="sidebar-icon">\n` +
			`    <img src="${iconPath}">\n` +
			`  </div>\n` +
			`  <span class="sidebar-text">${driveName}</span>\n` +
			`</span>`;
	}
	const sidebar = await Storage.get('sidebar');
	const driveList = driveElement.querySelector('.sidebar-nav-list');
	driveList.innerHTML = content;
	if (sidebar?.hideSection?.drives) {
		const sidebarCollapseClass = 'sidebar-nav-dropdown-collapsed';
		driveElement.classList.add(sidebarCollapseClass);
	}
};

/**
 * Initialize drive change detection
 * @returns {Promise<void>}
 */
const detectDriveInit = async (): Promise<void> => {
	if (!(await Storage.get('preference'))?.detectDriveChange) return;
	if (!driveInfo) {
		driveInfo = new DrivesAPI();
		await driveInfo.build();
	}
	driveInfo.detectChange(async () => {
		if (document.querySelector<HTMLInputElement>('.path-navigator').value === 'xplorer://Home') {
			const MAIN_DRIVES_ELEMENT = document.getElementById('drives');
			if (MAIN_DRIVES_ELEMENT.classList.contains('hidden')) MAIN_DRIVES_ELEMENT.classList.remove('hidden');
			const _driveSection = await Drives();
			MAIN_DRIVES_ELEMENT.innerHTML = _driveSection;
		}
		await writeSidebarDriveItems();
		updateTheme('favorites');
	});
};

export { writeSidebarDriveItems, Drives, drivesToElements, detectDriveInit };
