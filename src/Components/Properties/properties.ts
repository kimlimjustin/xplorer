import fs from 'fs';
import getType from '../Files/File Type/type';
import storage from 'electron-json-storage-sync';
import { isHiddenFile as checkIsHiddenFile } from 'is-hidden-file';
import moment from 'moment';
import getFolderSize from 'get-folder-size';
import formatBytes from '../Functions/filesize';
/**
 * Render file/folder properties into HTML
 * @param {Record<string, unknown>} options - File/folder's properties
 */
const RenderProperties = (options: Record<string, unknown>) => {
	const PROPERTIES_ELEMENT =
		document.querySelector<HTMLElement>('.properties');
	const PROPERTIES_BODY =
		PROPERTIES_ELEMENT.querySelector('.properties-body');
	PROPERTIES_ELEMENT.querySelector(
		'.properties-heading-exit'
	).addEventListener('click', () => {
		PROPERTIES_ELEMENT.style.animation = 'close-properties 1s forwards';
	});
	PROPERTIES_ELEMENT.style.animation = 'properties 1s forwards';

	let table: string;
	table = '<table class="properties-table"><tbody>';
	Object.keys(options).forEach((key) => {
		if (options[key] !== '') {
			const value =
				options[key] === 'calculating'
					? `<td class="properties-table-value" data-calculating="size">Calculating...</td>`
					: `<td class="properties-table-value">${options[key]}</td>`;
			table += `<tr><td>${key}</td class="properties-separator"><td>:</td>${value}</tr>`;
		}
	});
	table += '</tbody</table>';
	PROPERTIES_BODY.innerHTML = table;
};
/**
 * Show properties of a file
 * @param {string} filePath - Path of the file to show the properties
 * @returns {void}
 */
const Properties = (filePath: string): void => {
	const fileElement = document.querySelector<HTMLElement>(
		`[data-path="${escape(filePath)}"]`
	);
	let size: string,
		createdAt,
		modifiedAt,
		accessedAt,
		isHiddenFile,
		fileType,
		isDirectory;
	try {
		size = fileElement.querySelector('.file-size').innerHTML;
		if (fileElement.dataset.realPath)
			filePath = fileElement.dataset.realPath;
		createdAt = fileElement.dataset.createdAt;
		modifiedAt = fileElement.dataset.modifiedAt;
		accessedAt = fileElement.dataset.accessedAt;
		isHiddenFile = !!fileElement.dataset.hiddenFile;
		fileType = fileElement.querySelector('.file-type').innerHTML;
		isDirectory = fs.lstatSync(filePath).isDirectory();
	} catch (_) {
		const hideSystemFile =
			storage.get('preference')?.data?.hideSystemFiles ?? true;
		let getAttributesSync: any; //eslint-disable-line
		if (process.platform === 'win32')
			getAttributesSync = require('fswin').getAttributesSync; //eslint-disable-line
		isHiddenFile = checkIsHiddenFile(filePath); //eslint-disable-line
		fileType = getType(filePath, isDirectory);
		try {
			const stat = fs.statSync(filePath);
			createdAt = stat.ctime;
			modifiedAt = stat.mtime;
			accessedAt = stat.atime;
			size = String(stat.size);
		} catch (_) {
			if (process.platform === 'win32' && !hideSystemFile) {
				const stat = getAttributesSync(filePath);
				if (stat) {
					createdAt = stat.CREATION_TIME;
					modifiedAt = stat.LAST_WRITE_TIME;
					accessedAt = stat.LAST_ACCESS_TIME;
					size = stat.SIZE;
				}
			}
		}
	}
	if (isDirectory) {
		getFolderSize(filePath, (err, bytes) => {
			document.querySelector(`[data-calculating="size"]`).innerHTML =
				formatBytes(bytes);
		});
	}

	RenderProperties({
		Size: size ? size : 'calculating',
		'File Path': filePath,
		'File Type': fileType,
		'Created At': moment(createdAt).format('MMMM DD, YYYY (hh:mm A)'),
		'Modified At': moment(modifiedAt).format('MMMM DD, YYYY (hh:mm A)'),
		'Accessed At': moment(accessedAt).format('MMMM DD, YYYY (hh:mm A)'),
		'Is Hidden':
			String(isHiddenFile)[0].toUpperCase() +
			String(isHiddenFile).substring(1, String(isHiddenFile).length),
	});
};

export default Properties;
