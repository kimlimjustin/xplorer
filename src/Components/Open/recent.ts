import { startLoading, stopLoading } from '../Functions/Loading/loading';
import Storage from '../../Service/storage';
import fileThumbnail from '../Thumbnail/thumbnail';
import { updateTheme } from '../Theme/theme';
import type { OpenLogType } from '../Functions/log';
import FileAPI from '../../Service/files';
import FileMetaData from '../../Typings/fileMetaData';
import NormalizeSlash from '../Functions/path/normalizeSlash';
import formatBytes from '../Functions/filesize';
import { LOAD_IMAGE } from '../Functions/lazyLoadingImage';
import { GET_TAB_ELEMENT } from '../../Util/constants';

interface RecentType {
	path: string;
	timestamp: Date;
	properties: FileMetaData;
}
/**
 * Recent files handler
 * @returns {Promise<void>}
 */
const Recent = async (): Promise<void> => {
	startLoading();
	// Preference data
	const layout = (await Storage.get('layout'))?.['Recent'] ?? (await Storage.get('appearance'))?.layout ?? 's';
	const sort = (await Storage.get('sort'))?.['Recent'] ?? 'F';
	// Get the main element
	const MAIN_ELEMENT = GET_TAB_ELEMENT();
	MAIN_ELEMENT.innerHTML = '';
	if (MAIN_ELEMENT.classList.contains('empty-dir-notification')) MAIN_ELEMENT.classList.remove('empty-dir-notification'); // Remove class if exist
	// Get recent files list
	const _recents: OpenLogType[] = (await Storage.get('log'))?.opens ?? [];
	let recents = await Promise.all(
		_recents.map(async (_recent) => {
			const FileData = new FileAPI(_recent.path);
			if (!(await FileData.exists())) return null;
			const properties = await FileData.properties();
			return { path: _recent.path, timestamp: _recent.timestamp, properties };
		})
	);
	recents = recents.filter((recent) => recent !== null);
	if (!recents) {
		MAIN_ELEMENT.classList.add('empty-dir-notification');
		MAIN_ELEMENT.innerText = 'This folder is empty.';
		stopLoading();
		return;
	}
	recents = recents.sort((a, b) => {
		switch (sort) {
			case 'A': // A-Z
				return a.path.split('\\').pop().split('/').pop().toLowerCase() > b.path.split('\\').pop().split('/').pop().toLowerCase() ? 1 : -1;
			case 'Z': // Z-A
				return a.path.split('\\').pop().split('/').pop().toLowerCase() < b.path.split('\\').pop().split('/').pop().toLowerCase() ? 1 : -1;
			case 'L': // Last Modified
				return new Date(a.timestamp) < new Date(b.timestamp) ? -1 : 1;
			case 'F': // First Modified
				return new Date(a.timestamp) > new Date(b.timestamp) ? -1 : 1;
			case 'S': // Size
				return a.properties.size > b.properties.size ? 1 : -1;
			case 'T':
				return a.properties.file_type > b.properties.file_type ? 1 : -1;
		}
	});
	const __filterDuplicate = (arr: RecentType[]) => {
		const seen: string[] = [];
		const out = [];
		for (let i = 0; i < arr.length; i++) {
			const item = arr[i];
			if (seen.indexOf(NormalizeSlash(item.path)) === -1) {
				seen.push(NormalizeSlash(item.path));
				out.push(arr[i]);
			}
		}
		return out;
	};
	recents = __filterDuplicate(recents);
	if (!recents.length) {
		MAIN_ELEMENT.classList.add('empty-dir-notification');
		MAIN_ELEMENT.innerText = 'This folder is empty.';
	} else {
		for (const recent of recents) {
			const preview = await fileThumbnail(recent.path, recent.properties.is_dir ? 'folder' : 'file');
			const fileGrid = document.createElement('div');
			fileGrid.className = 'file-grid file grid-hover-effect';
			let displayName: string;
			switch (layout) {
				case 'm':
					fileGrid.classList.add('medium-grid-view');
					displayName =
						recent.properties.basename.length > 30 ? recent.properties.basename.substring(0, 30) + '...' : recent.properties.basename;
					break;
				case 'l':
					fileGrid.classList.add('large-grid-view');
					displayName =
						recent.properties.basename.length > 40 ? recent.properties.basename.substring(0, 40) + '...' : recent.properties.basename;
					break;
				case 'd':
					fileGrid.classList.add('detail-view');
					displayName = recent.properties.basename;
					break;
				default:
					fileGrid.classList.add('small-grid-view');
					displayName =
						recent.properties.basename.length > 20 ? recent.properties.basename.substring(0, 20) + '...' : recent.properties.basename;
					break;
			}
			fileGrid.setAttribute('draggable', 'true');
			fileGrid.dataset.isdir = String(recent.properties.is_dir);
			fileGrid.dataset.path = encodeURI(NormalizeSlash(recent.path));
			fileGrid.dataset.isSystem = String(recent.properties.is_system);
			fileGrid.dataset.isReadOnly = String(recent.properties.readonly);
			fileGrid.dataset.isHidden = String(recent.properties.is_hidden);
			fileGrid.innerHTML = `
            ${preview}
            <span class="file-grid-filename" id="file-filename">${displayName}</span>
			<span class="file-modifiedAt" id="file-timestamp">${new Date(recent.properties.last_modified?.secs_since_epoch * 1000).toLocaleString(
				navigator.language,
				{ hour12: false }
			)}</span>
            ${
				recent.properties.size > 0 && !recent.properties.is_dir
					? `<span class="file-size" id="file-size">${formatBytes(
							recent.properties.size // eslint-disable-next-line no-mixed-spaces-and-tabs
					  )}</span>`
					: `<span class="file-size" id="file-size"></span>`
			}
            <span class="file-type">${recent.properties.file_type}</span>
            `;
			MAIN_ELEMENT.appendChild(fileGrid);
		}
		updateTheme('grid');
		LOAD_IMAGE();
	}
	stopLoading();
};

export default Recent;
