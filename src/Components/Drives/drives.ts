import { getDiskInfoSync } from 'node-disk-info/dist/index';
import formatBytes from '../Functions/filesize';
import storage from 'electron-json-storage-sync';
import getDriveBasePath from '../Functions/basePath';
import Translate from '../I18n/i18n';
import fileThumbnail from '../Thumbnail/thumbnail';
import windowGUID from '../Constants/windowGUID';
import type Drive from 'node-disk-info/dist/classes/drive';
import focusingPath from '../Functions/focusingPath';
import { updateTheme } from '../Theme/theme';

/**
 * Function to get array of drives detected on the system
 * @returns {Array<Drive>} drives detected on the system
 */
const getDrives = async (): Promise<Array<Drive>> => {
	// Get all Physical disks Detected on the system
	//prettier-ignore
	const drives = await getDiskInfoSync().filter((drive) => drive.available > 0);
	// Get all USB Stick (for Linux and macOS)
	const USBStick: Drive[] = [];
	drives.forEach((drive) => {
		// If the drive is detected as not-first physical disk...
		if (
			drive.filesystem.indexOf('/sda') === -1 &&
			drive.filesystem.indexOf('tmpfs') === -1
		) {
			// ... push it into the USB Stick array
			USBStick.push(drive);
		}
	});
	return process.platform === 'win32' ? drives : USBStick;
};

interface uniqueDrives {
	filesystem: string;
	mounted: string;
	volumename: string;
}

/**
 * Get unique drives regardless space
 * @param {Array<Drive>} drives - drives array
 * @returns {uniqueDrives} unique drives array
 */
const getUniqueDrives = (drives: Array<Drive>): Array<uniqueDrives> => {
	const result: uniqueDrives[] = [];
	drives.forEach((drive) =>
		result.push({
			filesystem: drive.filesystem,
			mounted: drive.filesystem,
			volumename:
				drive.volumename && /[^?]/.test(drive.volumename)
					? drive.volumename
					: drive.filesystem,
		})
	);
	return result;
};

/**
 * Function to convert drives into HTML Tags
 * @param {Array} drives - Array of drives
 * @param {boolean} kBlockFormat - Is drive size presented as K-block-format (1024*n)? (optional)
 * @returns {string} Result
 */
const drivesToElements = (drives: Drive[], kBlockFormat = false): string => {
	let result = drives.length
		? `<h1 class="section-title">${Translate(
				process.platform === 'linux' ? 'Pendrives' : 'Drives'
		  )}</h1>` //eslint-disable-line
		: ''; // Element Result
	drives.forEach((drive: Drive) => {
		const driveName =
			drive.mounted.split('/')[drive.mounted.split('/').length - 1]; // Get name of drive
		result += `
        <div class="pendrive file card-hover-effect" data-isdir="true" data-path = "${getDriveBasePath(
			drive.mounted
		)}">
            <img src="${fileThumbnail(
				drive.filesystem === 'Removable Disk' ? 'usb' : 'hard-disk',
				'favorites',
				false
			)}" alt="USB icon" class="pendrive-icon">
            <div class="pendrive-info">
                ${
					drive.volumename || drive.filesystem
						? `<h4 class="pendrive-title">${
								drive.volumename &&
								/[^?]/.test(drive.volumename)
									? drive.volumename
									: drive.filesystem
						  } (${driveName})</h4>` //eslint-disable-line
						: `<h4 class="pendrive-title">${driveName}</h4>`
				}
                <div class="pendrive-total-capacity"><span class="pendrive-used-capacity" style="width: ${
					drive.capacity
				}"></span></div>
                <p>${formatBytes(drive.available, kBlockFormat)} ${Translate(
			'free of'
		)} ${formatBytes(drive.blocks, kBlockFormat)}</p>
            </div>
        </div>
        `;
	});
	return result;
};

/**
 * Create drives elements
 * @returns {string} drive section HTML code
 */
const Drives = async (): Promise<string> => {
	const drives = await getDrives();

	const tabs = storage.get(`tabs-${windowGUID}`)?.data;
	const focusingPath = tabs.tabs[tabs.focus].position;

	if (focusingPath === 'xplorer://Home') {
		switch (process.platform) {
			case 'win32':
				return `<section class="home-section" id="drives">${drivesToElements(
					drives
				)}</section>`;
			case 'darwin':
				return ''; // Xplorer does not support drives for macOS recently
			default:
				return `<section class="home-section" id="drives">${drivesToElements(
					drives,
					true
				)}</section>`;
		}
	} else return '';
};

/**
 * Get sidebar's drive element
 * @returns {string}
 */
const sidebarDrivesElement = async (): Promise<string> => {
	const { data } = storage.get('sidebar'); // Get user favorites data on sidebar
	const drives = await getDrives();
	if (!drives.length || process.platform === 'darwin')
		return `<div class="sidebar-nav-item" id="sidebar-drives"></div>`;
	// Return basic sidebar item element if there's no drives detected or its running on macOS
	else {
		let drivesElement = '';
		for (const drive of drives) {
			//prettier-ignore
			const driveName = process.platform === 'win32'
			//prettier-ignore
				? `${drive.volumename && /[^?]/.test(drive.volumename)
					? drive.volumename
					: drive.filesystem} (${drive.mounted})`
			//prettier-ignore
				: drive.mounted.split('/')[drive.mounted.split('/').length - 1]; // Get name of drive
			drivesElement += `<span data-path = "${getDriveBasePath(
				drive.mounted
			)}" data-isdir="true" class="sidebar-hover-effect drive-item"><img src="${fileThumbnail(
				drive.filesystem === 'Removable Disk' ? 'usb' : 'hard-disk',
				'favorites',
				false
			)}" alt="${driveName}"><span class="sidebar-text">${driveName}</span></span>`;
		}
		const result = `<div class="sidebar-nav-item sidebar-nav-drives ${
			data?.hideSection?.drives ? 'nav-hide-item' : ''
		}" id="sidebar-drives">
			<div class="sidebar-hover-effect">
			<span class="sidebar-nav-item-dropdown-btn" data-section="drives"><img src="${fileThumbnail(
				'hard-disk',
				'favorites',
				false
			)}" alt="Drives icon"><span class="sidebar-text">${
			process.platform === 'win32'
				? Translate('Drives')
				: Translate('Pendrives')
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
