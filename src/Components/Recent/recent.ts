import { startLoading, stopLoading } from '../Functions/loading';
import storage from 'electron-json-storage-sync';
import fileIcon from '../File Icon/fileIcon';
import LAZY_LOAD from '../Functions/lazyLoadingImage';
import { updateTheme } from '../Theme/theme';
import getType from '../File Type/type';
import fs from 'fs';
import { SelectListener } from '../File Operation/select';

/**
 * Recent files handler
 * @returns {Promise<void>}
 */
const Recent = async (): Promise<void> => {
	const { listenOpen } = require('../File Operation/open'); //eslint-disable-line
	startLoading();
	// Preference data
	const layout =
		storage.get('layout')?.data?.['Recent'] ??
		storage.get('preference')?.data?.layout ??
		's';
	const sort = storage.get('sort')?.data?.['Recent'] ?? 'A';
	// Get the main element
	const MAIN_ELEMENT = document.getElementById('workspace');
	MAIN_ELEMENT.innerHTML = '';
	if (MAIN_ELEMENT.classList.contains('empty-dir-notification'))
		MAIN_ELEMENT.classList.remove('empty-dir-notification'); // Remove class if exist
	// Get recent files list
	let recents = storage.get('recent')?.data;
	if (!recents) {
		MAIN_ELEMENT.classList.add('empty-dir-notification');
		MAIN_ELEMENT.innerText = 'This folder is empty.';
		stopLoading();
		return;
	}
	recents = recents.sort((a: string, b: string) => {
		switch (sort) {
			case 'A': // A-Z
				return a.split('\\').pop().split('/').pop().toLowerCase() >
					b.split('\\').pop().split('/').pop().toLowerCase()
					? 1
					: -1;
			case 'Z': // Z-A
				return a.split('\\').pop().split('/').pop().toLowerCase() <
					b.split('\\').pop().split('/').pop().toLowerCase()
					? 1
					: -1;
		}
	});
	recents = recents.filter((recent: string) => fs.existsSync(recent));
	if (!recents) {
		MAIN_ELEMENT.classList.add('empty-dir-notification');
		MAIN_ELEMENT.innerText = 'This folder is empty.';
	} else {
		for (const recent of recents) {
			const preview = await fileIcon(recent, 'file');
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
			fileGrid.setAttribute('data-listenOpen', '');
			fileGrid.setAttribute('data-tilt', '');
			fileGrid.dataset.path = escape(recent);
			fileGrid.innerHTML = `
            ${preview}
            <span class="file-grid-filename" id="file-filename">${recent
				.split('\\')
				.pop()
				.split('/')
				.pop()}</span>
            <span class="file-type">${getType(recent)}</span>
            `;
			MAIN_ELEMENT.appendChild(fileGrid);
		}
		updateTheme();
		SelectListener(document.querySelectorAll('.file'));
		listenOpen(document.querySelectorAll('[data-listenOpen]')); // Listen to open the file
		LAZY_LOAD();
	}
	stopLoading();
};

export default Recent;
