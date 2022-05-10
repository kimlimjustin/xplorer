import { customThumbnail, defaultThumbnail } from '../../Config/folder.config';
import { IMAGE_TYPES, VIDEO_TYPES } from '../../Config/file.config';
import getBasename from '../Functions/path/basename';
import Storage from '../../Service/storage';
import FileAPI from '../../Service/files';
import FileLib from '../../../lib/files.json';
import FolderLib from '../../../lib/folder.json';
import ThumbnailExtensionTrie from './thumbnailExtensionTrie';
import ThumbnailFileTrie from './thumbnailFileTrie';
import ThumbnailFolderTrie from './thumbnailFolderTrie';

let trieInitilized = false;
const extensionThumbnailTrie = new ThumbnailExtensionTrie();
const filenameThumbnailTrie = new ThumbnailFileTrie();
const folderThumbnailTrie = new ThumbnailFolderTrie();

const DEFAULT_FILE_THUMBNAIL = require(`../../Icon/${defaultThumbnail.DEFAULT_FILE_THUMBNAIL}`);
const DEFAULT_IMAGE_THUMBNAIL = require(`../../Icon/${defaultThumbnail.DEFAULT_IMAGE_THUMBNAIL}`);
/**
 * Return image view of preview
 * @param {string} source -Thumbnail source
 * @param {boolean} HTMLFormat - return with the HTML format
 * @param {boolean} isImg - return image as thumbnail
 * @returns {string} HTML Result
 */
const imageThumbnail = async (source: string, HTMLFormat?: boolean, isImg = false): Promise<string> => {
	if (!HTMLFormat) return (await new FileAPI(source).exists()) ? new FileAPI(source).readAsset() : require(`../../Icon/${source}`);
	return source?.startsWith('data:image/')
		? `<img class="file-grid-preview" src="${source}" />`
		: `<img data-src = "${source}" data-is-img=${isImg} class="file-grid-preview" src="${DEFAULT_FILE_THUMBNAIL}" onerror="this.onerror=null;this.src='${DEFAULT_IMAGE_THUMBNAIL}'" />`;
};

/**
 * Return video view of preview
 * @param {string} filename
 * @returns {string} HTML Result
 */
const videoPreview = async (filename: string): Promise<string> => {
	const appearance = await Storage.get('appearance');
	const alt = require(`../../Icon/${defaultThumbnail.DEFAULT_VIDEO_THUMBNAIL}`);
	return appearance?.videoAsThumbnail
		? `<video autoplay loop muted class="file-grid-preview"><source src = "${filename}" /><img src = "${alt}" /></video>`
		: imageThumbnail(alt, true);
};
/**
 * Get file icon of a file/folder
 * @param {string} filename - name of the file/folder
 * @param {string} category - category of the file/folder (optional)
 * @param {boolean} HTMLFormat - return with the HTML format (optional)
 * @param {boolean} imageAsThumbnail - return image as thumbnail (optional)
 * @returns {Promise<string>} the preview of the file/folder
 */
const fileThumbnail = async (filePath: string, category = 'folder', HTMLFormat = true, imageAsThumbnail = true): Promise<string> => {
	if (!trieInitilized) {
		for (const category of FileLib) {
			if (category.extensions?.length && category.thumbnail) {
				for (const extension of category.extensions) {
					extensionThumbnailTrie.insert(extension, category.thumbnail);
				}
			}
			if (category.fileNames?.length && category.thumbnail) {
				for (const fileName of category.fileNames) {
					filenameThumbnailTrie.insert(fileName, category.thumbnail);
				}
			}
		}
		for (const category of FolderLib) {
			if (category.folderNames?.length && category.thumbnail) {
				for (const folderName of category.folderNames) {
					folderThumbnailTrie.insert(folderName, category.thumbnail);
				}
			}
		}
		trieInitilized = true;
	}
	if (category === 'file' && filePath.indexOf('.') === -1) return imageThumbnail(defaultThumbnail.DEFAULT_FILE_THUMBNAIL, HTMLFormat);
	const ext = filePath.split('.').pop().toLowerCase(); // Get extension of filename
	const basename = getBasename(filePath).toLowerCase();
	const appearance = await Storage.get('appearance');
	if (category === 'file') {
		if (IMAGE_TYPES.indexOf(ext) !== -1) {
			if (imageAsThumbnail) {
				return imageThumbnail(filePath, HTMLFormat, true);
			} else {
				return imageThumbnail(DEFAULT_IMAGE_THUMBNAIL, HTMLFormat);
			}
		} else if (VIDEO_TYPES.indexOf(ext) !== -1) {
			const assetSrc = new FileAPI(filePath).readAsset();
			return HTMLFormat ? await videoPreview(assetSrc) : assetSrc;
		} else if ((appearance?.extractExeIcon ?? false) && (ext === 'exe' || ext === 'msi')) {
			return imageThumbnail(await new FileAPI(filePath).extractIcon(), HTMLFormat, true);
		}
	}

	const filename = filePath.toLowerCase(); // Lowercase filename
	if (category === 'contextmenu') {
		return imageThumbnail(`contextmenu/${filePath + '.svg'}`);
	}

	if (category === 'file') {
		return imageThumbnail(
			filenameThumbnailTrie.search(basename) ?? extensionThumbnailTrie.search(ext) ?? defaultThumbnail.DEFAULT_FILE_THUMBNAIL,
			HTMLFormat
		);
	} else {
		if (category !== 'folder') {
			const _key = `${category}-${filename}`;
			if (Object.keys(customThumbnail).indexOf(_key) !== -1) {
				return imageThumbnail(customThumbnail[_key], HTMLFormat);
			}
		}
		return imageThumbnail(folderThumbnailTrie.search(basename) ?? defaultThumbnail.DEFAULT_FOLDER_THUMBNAIL, HTMLFormat);
	}
};

export default fileThumbnail;
