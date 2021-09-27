import path from 'path';
import { getDiskInfoSync } from '../../Lib/node-disk-info/index';
import formatBytes from '../Functions/filesize';
import os from 'os';
import storage from 'electron-json-storage-sync';
import getDriveBasePath from '../Functions/basePath';
import Translate from '../I18n/i18n';
import fileIcon from '../Files/File Icon/fileIcon';
import windowGUID from '../Constants/windowGUID';
import type Drive from '../../Lib/node-disk-info/classes/drive';

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
			volumename: drive.volumename || drive.filesystem,
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
        <div class="pendrive file card-hover-effect" data-tilt data-isdir="true" data-listenOpen data-path = "${getDriveBasePath(
			drive.mounted
		)}">
            <img src="${fileIcon(
				drive.filesystem === 'Removable Disk' ? 'usb' : 'hard-disk',
				'favorites',
				false
			)}" alt="USB icon" class="pendrive-icon">
            <div class="pendrive-info">
                ${
					drive.volumename || drive.filesystem
						? `<h4 class="pendrive-title">${
								drive.volumename || drive.filesystem
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

export { Drives, getDrives, getUniqueDrives, drivesToElements, uniqueDrives };
