import formatBytes from '../Functions/filesize';
import Translate from '../I18n/i18n';
import fileThumbnail from '../Thumbnail/thumbnail';
import { updateTheme } from '../Theme/theme';
import DrivesAPI, { Drive } from '../../Api/drives';
import OS from '../../Api/platform';
import Storage from '../../Api/storage';
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
	let result = drives.length
		? `<h1 class="section-title">${await Translate(
				platform === 'linux' ? 'Pendrives' : 'Drives'
		  )}</h1>` //eslint-disable-line
		: ''; // Element Result
	for (const drive of drives) {
		const driveName =
			drive.mount_point.split('/')[
				drive.mount_point.split('/').length - 1
			]; // Get name of drive
		result += `
        <div class="pendrive file card-hover-effect" data-isdir="true" data-path = "${escape(
			drive.mount_point
		)}">
            <img src="${await fileThumbnail(
				drive.is_removable ? 'usb' : 'hard-disk',
				'favorites',
				false
			)}" alt="USB icon" class="pendrive-icon">
            <div class="pendrive-info">
                ${
					drive.name ?? drive.disk_type
						? `<h4 class="pendrive-title">${
								drive.name && /[^?]/.test(drive.name)
									? drive.name
									: drive.disk_type
						  } (${driveName})</h4>` //eslint-disable-line
						: `<h4 class="pendrive-title">${driveName}</h4>`
				}
                <div class="pendrive-total-capacity"><span class="pendrive-used-capacity" style="width: ${
					((drive.total_space - drive.available_space) /
						drive.total_space) *
						100 +
					'%'
				}"></span></div>
                <p>${formatBytes(drive.available_space)} ${await Translate(
			'free of'
		)} ${formatBytes(drive.total_space)}</p>
            </div>
        </div>
        `;
	}
	return result;
};

/**
 * Create drives elements
 * @returns {string} drive section HTML code
 */
const Drives = async (): Promise<string> => {
	//if (focusingPath() === 'xplorer://Home') {
	switch (platform) {
		case 'win32':
			return `<section class="home-section" id="drives">${await drivesToElements(
				driveInfo.DRIVES
			)}</section>`;
		case 'darwin':
			return ''; // Xplorer does not support drives for macOS currently
		default:
			return `<section class="home-section" id="drives">${await drivesToElements(
				driveInfo.DRIVES
			)}</section>`;
	}
	//} else return '';
};

/**
 * Get sidebar's drive element
 * @returns {string}
 */
const sidebarDrivesElement = async (): Promise<string> => {
	const data = await Storage.get('sidebar'); // Get user favorites data on sidebar
	const drives = driveInfo.DRIVES;
	if (!drives.length || platform === 'darwin')
		return `<div class="sidebar-nav-item" id="sidebar-drives"></div>`;
	// Return basic sidebar item element if there's no drives detected or its running on macOS
	else {
		let drivesElement = '';
		for (const drive of drives) {
			//prettier-ignore
			const driveName = platform === 'win32'
			//prettier-ignore
				? `${drive.name && /[^?]/.test(drive.name)
					? drive.name
					: drive.disk_type} (${drive.mount_point.replace(/\\$/g, '')})`
			//prettier-ignore
				: drive.mount_point.split('/')[drive.mount_point.split('/').length - 1]; // Get name of drive
			drivesElement += `<span data-path = "${await escape(
				drive.mount_point
			)}" data-isdir="true" class="sidebar-hover-effect drive-item"><img src="${await fileThumbnail(
				drive.is_removable ? 'usb' : 'hard-disk',
				'favorites',
				false
			)}" alt="${driveName}"><span class="sidebar-text">${driveName}</span></span>`;
		}
		const result = `<div class="sidebar-nav-item sidebar-nav-drives ${
			data?.hideSection?.drives ? 'nav-hide-item' : ''
		}" id="sidebar-drives">
			<div class="sidebar-hover-effect">
			<span class="sidebar-nav-item-dropdown-btn" data-section="drives"><img src="${await fileThumbnail(
				'hard-disk',
				'favorites',
				false
			)}" alt="Drives icon"><span class="sidebar-text">${
			platform === 'win32'
				? await Translate('Drives')
				: await Translate('Pendrives')
		}</span><div class="sidebar-nav-item-dropdown-spacer"></div></span>
			</div>
			<div class="sidebar-nav-item-dropdown-container">
				${drivesElement}
			</div>
		</div>`;
		return result;
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
		if (
			document.querySelector<HTMLInputElement>('.path-navigator')
				.value === 'xplorer://Home'
		) {
			const MAIN_DRIVES_ELEMENT = document.getElementById('drives');
			if (MAIN_DRIVES_ELEMENT.classList.contains('hidden'))
				MAIN_DRIVES_ELEMENT.classList.remove('hidden');
			const _driveSection = await Drives();
			MAIN_DRIVES_ELEMENT.innerHTML = _driveSection;
		}
		const _newElement = document.createElement('div');
		_newElement.innerHTML = (await sidebarDrivesElement()).trim();
		document
			.getElementById('sidebar-drives')
			.parentNode.replaceChild(
				_newElement.firstChild,
				document.getElementById('sidebar-drives')
			);
		updateTheme();
	});
};

export { sidebarDrivesElement, Drives, drivesToElements, detectDriveInit };
