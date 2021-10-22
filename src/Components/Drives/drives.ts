import formatBytes from '../Functions/filesize';
import Translate from '../I18n/i18n';
import fileThumbnail from '../Thumbnail/thumbnail';
import focusingPath from '../Functions/focusingPath';
import { updateTheme } from '../Theme/theme';
import DrivesAPI, { Drive } from '../../Api/drives';
import OS from '../../Api/platform';
let platform: string;
(async () => {
	platform = await OS();
})();
/**
 * Function to get array of drives detected on the system
 * @returns {Array<Drive>} drives detected on the system
 */
const getDrives = async (): Promise<Array<Drive>> => {
	// Get all Physical disks Detected on the system
	const drives = (await new DrivesAPI().get()).filter(
		(drive) => drive.available_space > 0
	);
	return drives;
};

interface uniqueDrives {
	mount_point: string;
	name: string;
}

/**
 * Get Disk Type (Removable Disk/Local Disk)
 * @param {boolean} is_removable - is it removable?
 * @returns {string}
 */
const getDiskType = (is_removable: boolean): string =>
	is_removable ? 'Removable Disk' : 'Local Disk';
/**
 * Get unique drives regardless space
 * @param {Array<Drive>} drives - drives array
 * @returns {uniqueDrives} unique drives array
 */
const getUniqueDrives = (drives: Array<Drive>): Array<uniqueDrives> => {
	const result: uniqueDrives[] = [];
	drives.forEach((drive) =>
		result.push({
			mount_point: drive.mount_point,
			name:
				drive.name && /[^?]/.test(drive.name)
					? drive.name
					: getDiskType(drive.is_removable),
		})
	);
	return result;
};

/**
 * Function to convert drives into HTML Tags
 * @param {Array} drives - Array of drives
 * @param {boolean} kBlockFormat - Is drive size presented as K-block-format (1024*n)? (optional)
 * @returns {Promise<string>} Result
 */
const drivesToElements = async (
	drives: Drive[],
	kBlockFormat = false
): Promise<string> => {
	let result = drives.length
		? `<h1 class="section-title">${await Translate(
				platform === 'linux' ? 'Pendrives' : 'Drives'
		  )}</h1>` //eslint-disable-line
		: ''; // Element Result
	for (const drive of drives) {
		if (
			drive.available_space > drive.total_space &&
			drive.name === 'Google Drive'
		)
			drive.total_space = 15 * 1024 * 1024 * 1024;
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
					drive.name ?? getDiskType(drive.is_removable)
						? `<h4 class="pendrive-title">${
								drive.name && /[^?]/.test(drive.name)
									? drive.name
									: getDiskType(drive.is_removable)
						  } (${driveName})</h4>` //eslint-disable-line
						: `<h4 class="pendrive-title">${driveName}</h4>`
				}
                <div class="pendrive-total-capacity"><span class="pendrive-used-capacity" style="width: ${
					(drive.available_space / drive.total_space) * 100 + '%'
				}"></span></div>
                <p>${formatBytes(
					drive.available_space,
					kBlockFormat
				)} ${await Translate('free of')} ${formatBytes(
			drive.total_space,
			kBlockFormat
		)}</p>
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
	const drives = await getDrives();

	//if (focusingPath() === 'xplorer://Home') {
	switch (platform) {
		case 'win32':
			return `<section class="home-section" id="drives">${await drivesToElements(
				drives
			)}</section>`;
		case 'darwin':
			return ''; // Xplorer does not support drives for macOS currently
		default:
			return `<section class="home-section" id="drives">${await drivesToElements(
				drives,
				true
			)}</section>`;
	}
	//} else return '';
};

/**
 * Get sidebar's drive element
 * @returns {string}
 */
const sidebarDrivesElement = async (): Promise<string> => {
	const data = JSON.parse(localStorage.getItem('sidebar')); // Get user favorites data on sidebar
	const drives = await getDrives();
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
					: getDiskType(drive.is_removable)} (${drive.mount_point.replace(/\\$/g, '')})`
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

const detectDrive = async (): Promise<void> => {
	let _drives = JSON.stringify(getUniqueDrives(await getDrives()));
	setInterval(async () => {
		const _newDrive = JSON.stringify(getUniqueDrives(await getDrives()));
		if (_newDrive !== _drives) {
			// Change home page's drive sectin
			if (focusingPath() === 'xplorer://Home') {
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
		}
		_drives = _newDrive;
	}, 500);
};

export {
	sidebarDrivesElement,
	Drives,
	getDrives,
	getUniqueDrives,
	drivesToElements,
	uniqueDrives,
	detectDrive,
};
