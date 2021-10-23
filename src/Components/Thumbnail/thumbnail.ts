import folderConfig, {
	customThumbnail,
	defaultThumbnail,
} from '../../Config/folder.config';
import FileConfig, { VIDEO_TYPES } from '../../Config/file.config';
import getBasename from '../Functions/basename';
import Storage from '../../Api/storage';
/**
 * Return image view of preview
 * @param {string} filename - the file name
 * @param {boolean} HTMLFormat - return with the HTML format
 * @returns {string} HTML Result
 */
const imageThumbnail = (filename: string, HTMLFormat?: boolean) => {
	if (!HTMLFormat) return filename;
	return `<img data-src = "${require(filename)}" class="file-grid-preview" src="${
		defaultThumbnail.DEFAULT_FILE_THUMBNAIL
	}" onerror="this.onerror=null;this.src='${
		defaultThumbnail.DEFAULT_IMAGE_THUMBNAIL
	}'" />`;
};

/**
 * Return video view of preview
 * @param {string} filename
 * @returns {string} HTML Result
 */
const videoPreview = async (filename: string): Promise<string> => {
	const preference = await Storage.get('preference');
	const alt = defaultThumbnail.DEFAULT_VIDEO_THUMBNAIL;
	return preference?.autoPlayPreviewVideo
		? `<video autoplay loop muted class="file-grid-preview"><source src = "${filename}" /><img src = "${alt}" /></video>`
		: imageThumbnail(alt, true);
};
/**
 * Get file icon of a file/folder
 * @param {string} filename - name of the file/folder
 * @param {string} category - category of the file/folder (optional)
 * @param {boolean} HTMLFormat - return with the HTML format (optional)
 * @returns {Promise<string>} the preview of the file/folder
 */
const fileThumbnail = async (
	filePath: string,
	category = 'folder',
	HTMLFormat = true
): Promise<string> => {
	const ext = filePath.split('.').pop().toLowerCase(); // Get extension of filename
	const basename = getBasename(filePath);

	if (VIDEO_TYPES.indexOf(ext) !== -1)
		return HTMLFormat ? await videoPreview(filePath) : filePath;

	const filename = filePath.toLowerCase(); // Lowercase filename
	if (category === 'contextmenu') {
		return imageThumbnail(
			await require(`../../Icon/contextmenu/${filePath + '.svg'}`)
		);
	}

	if (category === 'file') {
		for (const fileType of FileConfig()) {
			if (
				fileType?.fileNames?.indexOf(basename) !== undefined &&
				fileType?.fileNames?.indexOf(basename) !== -1
			) {
				const thumbnailPath = fileType.thumbnail?.(filePath);
				if (thumbnailPath) {
					return imageThumbnail(
						require(`../../Icon/${thumbnailPath}`),
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
						require(`../../Icon/${thumbnailPath}`),
						HTMLFormat
					);
				}
			}
		}
		return imageThumbnail(
			defaultThumbnail.DEFAULT_FILE_THUMBNAIL,
			HTMLFormat
		);
	} else {
		if (category !== 'folder') {
			const _key = `${category}-${filename}`;
			if (Object.keys(customThumbnail).indexOf(_key) !== -1) {
				return imageThumbnail(
					require(`../../Icon/${customThumbnail[_key]}`),
					HTMLFormat
				);
			}
		}
		for (const fldr of folderConfig()) {
			if (fldr.folderNames?.indexOf(basename) !== -1) {
				return imageThumbnail(
					require(`../../Icon/${fldr.thumbnail}`),
					HTMLFormat
				);
			}
		}
		return imageThumbnail(
			defaultThumbnail.DEFAULT_FOLDER_THUMBNAIL,
			HTMLFormat
		);
	}
};

export default fileThumbnail;
