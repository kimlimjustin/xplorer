import { URLify, eURLify } from '../../Functions/urlify';
import fs from 'fs';

interface FileTypes {
	extension?: string[];
	fileNames?: string[];
	folderNames?: string[];
	type: string;
	preview?: (filePath: string, cb: (html: string) => void) => void;
}

const IMAGE_TYPES = [
	'jpg',
	'png',
	'gif',
	'bmp',
	'jpeg',
	'jpe',
	'jif',
	'jfif',
	'jfi',
	'webp',
	'tiff',
	'tif',
	'ico',
	'svg',
	'webp',
];
const VIDEO_TYPES = [
	'mp4',
	'webm',
	'mpg',
	'mp2',
	'mpeg',
	'mpe',
	'mpv',
	'ocg',
	'm4p',
	'm4v',
	'avi',
	'wmv',
	'mov',
	'qt',
	'flv',
	'swf',
];

const previewCode = (filePath: string, language?: string) => {
	const hljs = require('highlight.js');
	const highlightedCode = language
		? hljs.highlight(fs.readFileSync(filePath, 'utf8'), {
				language: language,
		  }).value //eslint-disable-line no-mixed-spaces-and-tabs
		: hljs.highlightAuto(fs.readFileSync(filePath, 'utf8')).value;
	return `<pre class='preview-object' data-type="code"><code>${highlightedCode}</code></pre>`;
};

const FileTypesConfig = (): FileTypes[] => {
	return [
		{
			extension: ['js'],
			type: 'JavaScript',
			preview: (filePath: string, cb: (html: string) => void) =>
				cb(previewCode(filePath, 'javascript')),
		},
		{
			extension: ['ts'],
			type: 'TypeScript',
			preview: (filePath: string, cb: (html: string) => void) =>
				cb(previewCode(filePath, 'typescript')),
		},
		{
			extension: ['html', 'htm', 'xhtml', 'html_vm'],
			type: 'HyperText Markup Language',
			preview: (filePath: string, cb: (html: string) => void) =>
				cb(
					`<iframe src="${filePath}" title="${filePath}" class="preview-object"></iframe>`
				),
		},
		{
			extension: ['pdf'],
			type: 'Portable Document Format',
			preview: (filePath: string, cb: (html: string) => void) => {
				cb(
					`<object data="${filePath}#toolbar=0" type="application/pdf" class="preview-object"><embed src="${filePath}#toolbar=0" type="application/pdf" /></object>`
				);
			},
		},
		{
			extension: ['doc', 'docb', 'docm', 'dot', 'dotm', 'docx'],
			type: 'Word Document',
			preview: (filePath: string, cb: (html: string) => void) => {
				if (filePath.endsWith('docx')) {
					const mammoth = require('mammoth');
					mammoth
						.convertToHtml({ path: filePath })
						.then(({ value }: { value: string }) => {
							cb(
								eURLify(
									`<div class='preview-object' data-type="docx">${value}</div>`
								)
							);
						});
				}
			},
		},
		{
			extension: ['xlsx', 'xls', 'xlsb', 'xls', 'ods', 'fods', 'csv'],
			type: 'Excel Document',
			preview: (filePath: string, cb: (html: string) => void) => {
				const XLSX = require('xlsx');
				const xlsxData = XLSX.readFile(filePath);
				const parsedData = XLSX.utils.sheet_to_html(
					xlsxData.Sheets[xlsxData.SheetNames[0]]
				);
				cb(
					`<div class='preview-object' data-type="xlsx">${URLify(
						parsedData
					)}</div>`
				);
			},
		},
		{
			extension: [
				'pot',
				'potm',
				'potx',
				'ppam',
				'pps',
				'ppsm',
				'ppsx',
				'ppt',
				'pptn',
				'pptx',
			],
			type: 'Powerpoint Document',
		},
		{
			extension: [
				'7z',
				'brotli',
				'bzip2',
				'gz',
				'gzip',
				'rar',
				'tgz',
				'xz',
				'zip',
			],
			type: 'Archive',
		},
		{
			extension: [
				'accdb',
				'db',
				'db3',
				'mdb',
				'pdb',
				'pgsql',
				'pkb',
				'pks',
				'postgres',
				'psql',
				'sql',
				'sqlite',
				'sqlite3',
			],
			type: 'Database',
		},
		{
			extension: ['bat'],
			type: 'Batch',
			preview: (filePath: string, cb: (html: string) => void) =>
				cb(previewCode(filePath, 'bat')),
		},
		{
			extension: ['exe'],
			type: 'Executable',
			preview: (filePath: string, cb: (html: string) => void) =>
				cb(previewCode(filePath, 'bat')),
		},
		{
			extension: ['c++', 'cc', 'cpp', 'cp'],
			type: 'C++ Program',
			preview: (filePath: string, cb: (html: string) => void) =>
				cb(previewCode(filePath, 'c++')),
		},
		{
			extension: ['c'],
			type: 'C Program',
			preview: (filePath: string, cb: (html: string) => void) =>
				cb(previewCode(filePath, 'c')),
		},
		{
			extension: ['h'],
			type: 'C Header File',
			preview: (filePath: string, cb: (html: string) => void) =>
				cb(previewCode(filePath, 'c')),
		},
		{
			extension: ['py', 'py3'],
			type: 'Python Program',
			preview: (filePath: string, cb: (html: string) => void) =>
				cb(previewCode(filePath, 'python')),
		},
		{
			extension: ['txt'],
			type: 'Text Document',
			preview: (filePath: string, cb: (html: string) => void) => {
				cb(
					`<div class='preview-object' data-type="txt">${fs
						.readFileSync(filePath, 'utf8')
						.replaceAll('\n', '<br />')}</div>`
				);
			},
		},
		{
			extension: IMAGE_TYPES,
			type: 'Image',
			preview: (filePath: string, cb: (html: string) => void) =>
				cb(
					`<div class="preview-object" data-type="img"><img src="${filePath}" data-path="${filePath}" /></div>`
				),
		},
		{
			extension: VIDEO_TYPES,
			type: 'Video',
			preview: (filePath: string, cb: (html: string) => void) =>
				cb(
					`<div class="preview-object" data-type="video"><video controls=""><source src="${filePath}"></video></div>`
				),
		},
		{
			extension: ['deb', 'msi', 'snap'],
			type: 'Installer',
		},
		{
			extension: ['iso'],
			type: 'Disk Image File',
		},
		{
			extension: ['Dockerfile'],
			fileNames: ['Dockerfile'],
			type: 'Docker Image',
			preview: (filePath: string, cb: (html: string) => void) =>
				cb(previewCode(filePath, 'docker')),
		},
		{
			extension: ['md', 'markdown'],
			type: 'Markdown',
			preview: (filePath: string, cb: (html: string) => void) =>
				cb(previewCode(filePath, 'md')),
		},
		{
			extension: ['json'],
			type: 'JavaScript Object Notation',
			preview: (filePath: string, cb: (html: string) => void) => {
				cb(previewCode(filePath, 'json'));
			},
		},
		{
			folderNames: ['.git'],
			type: 'Git',
			fileNames: ['gitignore', 'gitconfig'],
			preview: (filePath: string, cb: (html: string) => void) =>
				cb(previewCode(filePath)),
		},
		{
			fileNames: ['yml', 'yaml'],
			type: 'Yet Anoter Markup Language',
			preview: (filePath: string, cb: (html: string) => void) =>
				cb(previewCode(filePath, 'yml')),
		},
		{
			folderNames: ['node_modules'],
			type: 'Node Packages',
		},
		{
			fileNames: ['.prettierignore', '.prettierrc.json'],
			type: 'Prettier configuration file',
			preview: (filePath: string, cb: (html: string) => void) =>
				cb(previewCode(filePath)),
		},
		{
			fileNames: ['binding.gyp'],
			type: 'Node JS C++ Binding',
			preview: (filePath: string, cb: (html: string) => void) =>
				cb(previewCode(filePath)),
		},
		{
			fileNames: ['LICENSE', 'LICENSE.md', 'LICENSE.txt'],
			type: 'License',
			preview: (filePath: string, cb: (html: string) => void) =>
				cb(previewCode(filePath, 'md')),
		},
	];
};

export { IMAGE_TYPES, VIDEO_TYPES };
export default FileTypesConfig;
