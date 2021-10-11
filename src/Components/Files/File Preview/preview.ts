import path from 'path';
import { updateTheme } from '../../Theme/theme';
import mammoth from 'mammoth';
import fs from 'fs';
import XLSX from 'xlsx';
import { URLify, eURLify } from '../../Functions/urlify';
import hljs from 'highlight.js';
import marked from 'marked';
import storage from 'electron-json-storage-sync';
import { IMAGE_TYPES, VIDEO_TYPES } from '../../Constants/fileTypes';

//prettier-ignore
const FILE_TYPES_AVAILABLE_FOR_PREVIEW = ['.pdf', '.html', '.docx', '.htm', '.xlsx', '.xls', '.xlsb', 'xls', '.ods', '.fods', '.csv', '.txt', '.py', '.js', '.bat', '.css', '.c++', '.cpp', '.cc', '.c', '.diff', '.patch', '.go', '.java', '.json', '.php', '.ts', '.tsx', '.jsx', '.jpg', '.png', '.gif', '.bmp', '.jpeg', '.jpe', '.jif', '.jfif', '.jfi', '.webp', '.tiff', '.tif', '.ico', '.svg', '.webp', '.mp4', '.webm', '.mpg', '.mp2', '.mpeg', '.mpe', '.mpv', '.ocg', '.m4p', '.m4v', '.avi', '.wmv', '.mov', '.qt', '.flv', '.swf', '.md']

/**
 * Close the preview file
 * @returns {void}
 */
const closePreviewFile = (): void => {
	document.getElementById('workspace').classList.remove('workspace-split');
	document
		.querySelectorAll('.preview')
		.forEach((element) => element.parentNode.removeChild(element));
	document.querySelector<HTMLElement>('.main-box').style.overflowY = 'auto';
};
/**
 * Show preview file
 * @param {string} filePath - file to preview
 * @returns {void}
 */
const Preview = (filePath: string): void => {
	closePreviewFile();
	const previewElement = document.createElement('div');
	previewElement.classList.add('preview');
	const changePreview = (html: string) => {
		previewElement.innerHTML = `
                <div class="preview-header">
                    <span class="preview-path">${path.basename(filePath)}</span>
                    <span class="preview-exit-btn">&times;</span>
                </div>
                ${html}
                `;

		document.querySelector<HTMLElement>('.main-box').scrollTop = 0;
		document.querySelector<HTMLElement>('.main-box').style.overflowY =
			'hidden';
		document
			.getElementById('workspace')
			.classList.toggle('workspace-split');
		document.querySelector('.main-box').appendChild(previewElement);
		previewElement
			.querySelector('.preview-exit-btn')
			.addEventListener('click', () => closePreviewFile());
	};
	if (path.extname(filePath) === '.pdf') {
		changePreview(
			`<object data="${filePath}#toolbar=0" type="application/pdf" class="preview-object"><embed src="${filePath}#toolbar=0" type="application/pdf" /></object>`
		);
	} else if (
		path.extname(filePath) === '.html' ||
		path.extname(filePath) === '.htm'
	) {
		changePreview(
			`<iframe src="${filePath}" title="${filePath}" class="preview-object"></iframe>`
		);
	} else if (
		['.xlsx', '.xls', '.xlsb', 'xls', '.ods', '.fods', '.csv'].indexOf(
			path.extname(filePath)
		) !== -1
	) {
		const xlsxData = XLSX.readFile(filePath);
		const parsedData = XLSX.utils.sheet_to_html(
			xlsxData.Sheets[xlsxData.SheetNames[0]]
		);
		changePreview(
			`<div class='preview-object' data-type="xlsx">${URLify(
				parsedData
			)}</div>`
		);
	} else if (path.extname(filePath) === '.txt') {
		changePreview(
			`<div class='preview-object' data-type="txt">${fs
				.readFileSync(filePath, 'utf8')
				.replaceAll('\n', '<br />')}</div>`
		);
	} else if (path.extname(filePath) === '.docx') {
		mammoth.convertToHtml({ path: filePath }).then(({ value }) => {
			changePreview(
				eURLify(
					`<div class='preview-object' data-type="docx">${value}</div>`
				)
			);
		});
	} else if (IMAGE_TYPES.indexOf(path.extname(filePath)) !== -1) {
		changePreview(
			`<div class="preview-object" data-type="img"><img src="${filePath}" data-path="${filePath}" /></div>`
		);
	} else if (VIDEO_TYPES.indexOf(path.extname(filePath)) !== -1) {
		changePreview(
			`<div class="preview-object" data-type="video"><video controls=""><source src="${filePath}"></video></div>`
		);
	} else if (path.extname(filePath) === '.md') {
		const parsedData = marked(fs.readFileSync(filePath, 'utf8'));
		changePreview(
			`<div class="preview-object" data-type="md">${eURLify(
				parsedData
			)}</div>`
		);
	} else {
		let language;
		switch (path.extname(filePath)) {
			case '.py':
				language = 'python';
				break;
			case '.js':
				language = 'javascript';
				break;
			case '.tx':
				language = 'typescript';
				break;
			case '.css':
				language = 'css';
				break;
			case '.cpp':
			case '.c++':
			case '.cc':
				language = 'c++';
				break;
			case '.c':
				language = 'c';
				break;
			case '.diff':
			case '.patch':
				language = 'diff';
				break;
			case '.json':
				language = 'json';
				break;
		}
		const highlightedCode = language
			? hljs.highlight(fs.readFileSync(filePath, 'utf8'), {
					language: language,
			  }).value //eslint-disable-line no-mixed-spaces-and-tabs
			: hljs.highlightAuto(fs.readFileSync(filePath, 'utf8')).value;
		changePreview(
			`<pre class='preview-object' data-type="code"><code>${highlightedCode}</code></pre>`
		);
	}
	const recents = storage.get('recent')?.data;

	// Push file into recent files
	if (recents) {
		if (recents.indexOf(filePath) !== -1) {
			recents.push(recents.splice(recents.indexOf(filePath), 1)[0]);
			storage.set('recent', recents);
		} else {
			storage.set('recent', [...recents, filePath]);
		}
	} else storage.set('recent', [filePath]);
	updateTheme();
};

export { Preview, FILE_TYPES_AVAILABLE_FOR_PREVIEW, closePreviewFile };
