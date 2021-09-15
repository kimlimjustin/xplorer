import fs from 'fs';
import getType from '../Files/File Type/type';
import storage from 'electron-json-storage-sync';
import { isHiddenFile as checkIsHiddenFile } from 'is-hidden-file';
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
	table = '<table><tbody>';
	Object.keys(options).forEach((key) => {
		if (options[key] !== '') {
			table += `<tr><td>${key}</td><td>${options[key]}</td></tr>`;
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
	let size, createdAt, modifiedAt, accessedAt, isHiddenFile, fileType;
	try {
		size = fileElement.querySelector('.file-size').innerHTML;
		if (fileElement.dataset.realPath)
			filePath = fileElement.dataset.realPath;
		createdAt = fileElement.dataset.createdAt;
		modifiedAt = fileElement.dataset.modifiedAt;
		accessedAt = fileElement.dataset.accessedAt;
		isHiddenFile = !!fileElement.dataset.hiddenFile;
		fileType = fileElement.querySelector('.file-type').innerHTML;
	} catch (_) {
		const hideSystemFile =
			storage.get('preference')?.data?.hideSystemFiles ?? true;
		let getAttributesSync: any; //eslint-disable-line
		if (process.platform === 'win32')
			getAttributesSync = require('fswin').getAttributesSync; //eslint-disable-line
		isHiddenFile = checkIsHiddenFile(filePath); //eslint-disable-line
		fileType = fs.lstatSync(filePath).isDirectory()
			? 'File Folder'
			: getType(filePath);
		try {
			const stat = fs.statSync(filePath);
			createdAt = stat.ctime;
			modifiedAt = stat.mtime;
			accessedAt = stat.atime;
			size = stat.size;
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

	RenderProperties({
		Size: size,
		'File Path': filePath,
		'File Type': fileType,
		'Created At': createdAt,
		'Modified At': modifiedAt,
		'Accessed At': accessedAt,
		'Is Hidden': isHiddenFile,
	});
};

export default Properties;
