import fs from 'fs';
import path from 'path';
import folderConfig, {
	defaultThumbnail,
	customThumbnail,
} from '../Config/folder.config';
import FileConfig, { VIDEO_TYPES } from '../Config/file.config';

const DEFAULT_FILE_ICON = path.join(
	__dirname,
	'../../icon',
	defaultThumbnail.file
);
const DEFAULT_FOLDER_ICON = path.join(
	__dirname,
	'../../icon',
	defaultThumbnail.folder
);

const DEFAULT_IMAGE = path.join(
	__dirname,
	'../../icon',
	defaultThumbnail.image
);

/**
 * Return image view of preview
 * @param {string} filename - the file name
 * @param {boolean} isdir - is it directory?
 * @param {boolean} HTMLFormat - return with the HTML format
 * @returns {string} HTML Result
 */
const imageThumbnail = (
	filename: string,
	isdir?: boolean,
	HTMLFormat?: boolean
) => {
	if (!HTMLFormat) return filename;
	return `<img data-src = "${filename}" class="file-grid-preview" src="${
		isdir ? DEFAULT_FOLDER_ICON : DEFAULT_FILE_ICON
	}" onerror="this.onerror=null;this.src='${DEFAULT_IMAGE}'" />`;
};

/**
 * Return video view of preview
 * @param {string} filename
 * @returns {string} HTML Result
 */
const videoPreview = (filename: string): string => {
	const storage = require('electron-json-storage-sync');
	const preference = storage.get('preference')?.data;
	const alt = path.join(__dirname, '../../icon', defaultThumbnail.video);
	return preference?.autoPlayPreviewVideo
		? `<video autoplay loop muted class="file-grid-preview"><source src = "${filename}" /><img src = "${alt}" /></video>`
		: imageThumbnail(alt, false, true);
};
/**
 * Get file icon of a file/folder
 * @param {string} filename - name of the file/folder
 * @param {string} category - category of the file/folder (optional)
 * @param {boolean} HTMLFormat - return with the HTML format (optional)
 * @returns {string} the preview of the file/folder
 */
const fileThumbnail = (
	filePath: string,
	category = 'folder',
	HTMLFormat = true
): string => {
	const ext = filePath.split('.').pop().toLowerCase(); // Get extension of filename
	const basename = path.basename(filePath);

	if (VIDEO_TYPES.indexOf(ext) !== -1)
		return HTMLFormat ? videoPreview(filePath) : filePath;

	const filename = filePath.toLowerCase(); // Lowercase filename

	if (category === 'file') {
		for (const fileType of FileConfig()) {
			if (
				fileType?.fileNames?.indexOf(basename) !== undefined &&
				fileType?.fileNames?.indexOf(basename) !== -1
			) {
				const thumbnailPath = fileType.thumbnail?.(filePath);
				if (thumbnailPath) {
					return imageThumbnail(
						fs.existsSync(thumbnailPath)
							? thumbnailPath
							: path.join(__dirname, '../../icon', thumbnailPath),
						false,
						HTMLFormat
					);
				}
			}
		}
		for (const fileType of FileConfig()) {
			if (
				fileType.extension?.indexOf(ext) !== undefined &&
				fileType.extension?.indexOf(ext) !== -1
			) {
				const thumbnailPath = fileType.thumbnail?.(filePath);
				if (thumbnailPath) {
					return imageThumbnail(
						fs.existsSync(thumbnailPath)
							? thumbnailPath
							: path.join(__dirname, '../../icon', thumbnailPath),
						false,
						HTMLFormat
					);
				}
			}
		}
		return imageThumbnail(DEFAULT_FILE_ICON, false, HTMLFormat);
	} else {
		if (category !== 'folder') {
			const _key = `${category}-${filename}`;
			if (Object.keys(customThumbnail).indexOf(_key) !== -1) {
				return imageThumbnail(
					path.join(__dirname, '../../icon', customThumbnail[_key]),
					false,
					HTMLFormat
				);
			}
		}
		for (const fldr of folderConfig()) {
			if (fldr.folderNames?.indexOf(basename) !== -1) {
				return imageThumbnail(
					path.join(__dirname, '../../icon', fldr.thumbnail),
					false,
					HTMLFormat
				);
			}
		}
		return imageThumbnail(DEFAULT_FOLDER_ICON, false, HTMLFormat);
	}
};

export default fileThumbnail;
