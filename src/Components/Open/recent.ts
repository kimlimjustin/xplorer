import { startLoading, stopLoading } from '../Functions/Loading/loading';
import Storage from '../../Api/storage';
import fileThumbnail from '../Thumbnail/thumbnail';
import LAZY_LOAD from '../Functions/lazyLoadingImage';
import { updateTheme } from '../Theme/theme';
import getType from '../Files/File Type/type';
//import { SelectListener } from '../Files/File Operation/select';
import type { OpenLogType } from '../Functions/log';
import getBasename from '../Functions/basename';
import DirectoryAPI from '../../Api/directory';

/**
 * Recent files handler
 * @returns {Promise<void>}
 */
const Recent = async (): Promise<void> => {
	startLoading();
	// Preference data
	const layout =
		(await Storage.get('layout'))?.['Recent'] ??
		(await Storage.get('preference'))?.layout ??
		's';
	const sort = (await Storage.get('sort'))?.['Recent'] ?? 'A';
	// Get the main element
	const MAIN_ELEMENT = document.getElementById('workspace');
	MAIN_ELEMENT.innerHTML = '';
	if (MAIN_ELEMENT.classList.contains('empty-dir-notification'))
		MAIN_ELEMENT.classList.remove('empty-dir-notification'); // Remove class if exist
	// Get recent files list
	let recents: OpenLogType[] = (await Storage.get('log'))?.opens ?? [];
	if (!recents) {
		MAIN_ELEMENT.classList.add('empty-dir-notification');
		MAIN_ELEMENT.innerText = 'This folder is empty.';
		stopLoading();
		return;
	}
	recents = recents.sort((a: OpenLogType, b: OpenLogType) => {
		switch (sort) {
			case 'A': // A-Z
				return a.path.split('\\').pop().split('/').pop().toLowerCase() >
					b.path.split('\\').pop().split('/').pop().toLowerCase()
					? 1
					: -1;
			case 'Z': // Z-A
				return a.path.split('\\').pop().split('/').pop().toLowerCase() <
					b.path.split('\\').pop().split('/').pop().toLowerCase()
					? 1
					: -1;
			case 'L': // Last Modified
				return new Date(a.date) < new Date(b.date) ? -1 : 1;
			case 'F': // First Modified
				new Date(a.date) > new Date(b.date) ? -1 : 1;
		}
	});
	const __filterDuplicate = (arr: OpenLogType[]) => {
		const seen: string[] = [];
		const out = [];
		for (let i = 0; i < arr.length; i++) {
			const item = arr[i];
			if (seen.indexOf(item.path) === -1) {
				seen.push(item.path);
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
			const isdir = await new DirectoryAPI(recent.path).isDir();
			const preview = await fileThumbnail(
				recent.path,
				isdir ? 'folder' : 'file'
			);
			const fileGrid = document.createElement('div');
			fileGrid.className = 'file-grid file grid-hover-effect';
			switch (layout) {
				case 'm':
					fileGrid.classList.add('medium-grid-view');
					break;
				case 'l':
					fileGrid.classList.add('large-grid-view');
					break;
				case 'd':
					fileGrid.classList.add('detail-view');
					break;
				default:
					fileGrid.classList.add('small-grid-view');
					break;
			}
			fileGrid.setAttribute('draggable', 'true');
			fileGrid.dataset.path = escape(recent.path);
			fileGrid.dataset.isdir = String(isdir);
			fileGrid.innerHTML = `
            ${preview}
            <span class="file-grid-filename" id="file-filename">${getBasename(
				recent.path
			)}</span>
            <span class="file-type">${getType(recent.path)}</span>
            `;
			MAIN_ELEMENT.appendChild(fileGrid);
		}
		updateTheme();
		//SelectListener(document.querySelectorAll('.file'));
		LAZY_LOAD();
	}
	stopLoading();
};

export default Recent;
