import { URLify, eURLify } from '../Functions/urlify';
import fs from 'fs';

interface FileConfigType {
	extension?: string[];
	fileNames?: string[];
	type: string;
	preview?: (filePath: string, cb: (html: string) => void) => void;
	thumbnail?: (filePath?: string) => string;
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

const FileConfig = (): FileConfigType[] => {
	return [
		{
			extension: ['js'],
			type: 'JavaScript',
			thumbnail: () => 'extension/javascript.svg',
			preview: (filePath: string, cb: (html: string) => void) =>
				cb(previewCode(filePath, 'javascript')),
		},
		{
			extension: ['ts'],
			type: 'TypeScript',
			thumbnail: () => 'extension/file.svg',
			preview: (filePath: string, cb: (html: string) => void) =>
				cb(previewCode(filePath, 'typescript')),
		},
		{
			extension: ['html', 'htm', 'xhtml', 'html_vm', 'asp'],
			thumbnail: () => 'extension/html.svg',
			type: 'HyperText Markup Language',
			preview: (filePath: string, cb: (html: string) => void) =>
				cb(
					`<iframe src="${filePath}" title="${filePath}" class="preview-object"></iframe>`
				),
		},
		{
			extension: ['pdf'],
			type: 'Portable Document Format',
			thumbnail: () => 'extension/pdf.svg',
			preview: (filePath: string, cb: (html: string) => void) => {
				cb(
					`<object data="${filePath}#toolbar=0" type="application/pdf" class="preview-object"><embed src="${filePath}#toolbar=0" type="application/pdf" /></object>`
				);
			},
		},
		{
			extension: ['doc', 'docb', 'docm', 'dot', 'dotm', 'docx', 'rtf'],
			type: 'Word Document',
			thumbnail: () => 'extension/word.svg',
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
			thumbnail: () => 'extension/excel.svg',
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
			thumbnail: () => 'extension/powerpoint.svg',
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
			thumbnail: () => 'extension/zip.svg',
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
			thumbnail: () => 'extension/database.svg',
		},
		{
			extension: ['bat'],
			type: 'Batch',
			thumbnail: () => 'extension/bat.svg',
			preview: (filePath: string, cb: (html: string) => void) =>
				cb(previewCode(filePath, 'bat')),
		},
		{
			extension: ['exe'],
			type: 'Executable',
			thumbnail: (filePath: string) => {
				const storage = require('electron-json-storage-sync');
				const preference = storage.get('preference')?.data;
				const extractExeIcon =
					require('../Functions/extractExeIcon').default;
				try {
					if (
						(preference?.extractExeIcon ?? false) &&
						process.platform === 'win32'
					) {
						return extractExeIcon(filePath);
					}
				} catch (err) {
					console.log(err);
					return 'extension/exe.svg';
				}
				extractExeIcon(filePath);
			},
			preview: (filePath: string, cb: (html: string) => void) =>
				cb(previewCode(filePath, 'bat')),
		},
		{
			extension: ['cc', 'cpp', 'cxx', 'c++', 'cp', 'mm', 'mii', 'ii'],
			thumbnail: () => 'extension/cpp.svg',
			type: 'C++ Program',
			preview: (filePath: string, cb: (html: string) => void) =>
				cb(previewCode(filePath, 'c++')),
		},
		{
			extension: ['c'],
			thumbnail: () => 'extension/c.svg',
			type: 'C Program',
			preview: (filePath: string, cb: (html: string) => void) =>
				cb(previewCode(filePath, 'c')),
		},
		{
			extension: ['h'],
			thumbnail: () => 'extension/h.svg',
			type: 'C Header File',
			preview: (filePath: string, cb: (html: string) => void) =>
				cb(previewCode(filePath, 'c')),
		},
		{
			extension: ['py', 'py3'],
			thumbnail: () => 'extension/python.svg',
			type: 'Python Program',
			preview: (filePath: string, cb: (html: string) => void) =>
				cb(previewCode(filePath, 'python')),
		},
		{
			extension: ['pyc', 'pylintrc', 'python-version'],
			thumbnail: () => 'extension/python-misc.svg',
			type: 'Python Program',
		},
		{
			extension: ['txt'],
			thumbnail: () => 'extension/txt.svg',
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
			thumbnail: (filePath: string) => filePath,
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
			thumbnail: () => 'extension/exe.svg',
			type: 'Installer',
		},
		{
			extension: ['iso'],
			type: 'Disk Image File',
			thumbnail: () => 'extension/disc.svg',
		},
		{
			extension: ['dockerfile', 'dockerignore'],
			fileNames: [
				'dockerfile',
				'dockerfile.prod',
				'dockerfile.production',
				'dockerfile.alpha',
				'dockerfile.beta',
				'dockerfile.stage',
				'dockerfile.staging',
				'dockerfile.dev',
				'dockerfile.development',
				'dockerfile.local',
				'dockerfile.test',
				'dockerfile.testing',
				'dockerfile.ci',
				'dockerfile.web',
				'dockerfile.worker',

				'docker-compose.yml',
				'docker-compose.override.yml',
				'docker-compose.prod.yml',
				'docker-compose.production.yml',
				'docker-compose.alpha.yml',
				'docker-compose.beta.yml',
				'docker-compose.stage.yml',
				'docker-compose.staging.yml',
				'docker-compose.dev.yml',
				'docker-compose.development.yml',
				'docker-compose.local.yml',
				'docker-compose.test.yml',
				'docker-compose.testing.yml',
				'docker-compose.ci.yml',
				'docker-compose.web.yml',
				'docker-compose.worker.yml',

				'docker-compose.yaml',
				'docker-compose.override.yaml',
				'docker-compose.prod.yaml',
				'docker-compose.production.yaml',
				'docker-compose.alpha.yaml',
				'docker-compose.beta.yaml',
				'docker-compose.stage.yaml',
				'docker-compose.staging.yaml',
				'docker-compose.dev.yaml',
				'docker-compose.development.yaml',
				'docker-compose.local.yaml',
				'docker-compose.test.yaml',
				'docker-compose.testing.yaml',
				'docker-compose.ci.yaml',
				'docker-compose.web.yaml',
				'docker-compose.worker.yaml',
			],
			thumbnail: () => 'extension/docker.svg',
			type: 'Docker Image',
			preview: (filePath: string, cb: (html: string) => void) =>
				cb(previewCode(filePath, 'docker')),
		},
		{
			extension: ['md', 'markdown', 'rst'],
			type: 'Markdown',
			thumbnail: () => 'extension/markdown.svg',
			preview: (filePath: string, cb: (html: string) => void) =>
				cb(previewCode(filePath, 'md')),
		},
		{
			extension: ['json', 'tsbuildinfo', 'json5', 'jsonl', 'ndjson'],
			type: 'JavaScript Object Notation',
			thumbnail: () => 'extension/json.svg',
			preview: (filePath: string, cb: (html: string) => void) => {
				cb(previewCode(filePath, 'json'));
			},
		},
		{
			type: 'Git',
			fileNames: [
				'.gitignore',
				'.gitignore_global',
				'.gitconfig',
				'.gitattributes',
				'.gitmodules',
				'.gitkeep',
				'git-history',
			],
			thumbnail: () => 'extension/git.svg',
			preview: (filePath: string, cb: (html: string) => void) =>
				cb(previewCode(filePath)),
		},
		{
			extension: ['yml', 'yaml'],
			type: 'Yet Anoter Markup Language',
			thumbnail: () => 'extension/yaml.svg',
			preview: (filePath: string, cb: (html: string) => void) =>
				cb(previewCode(filePath, 'yml')),
		},
		{
			fileNames: ['.prettierignore', '.prettierrc.json'],
			type: 'Prettier configuration file',
			thumbnail: () => 'extension/prettier.svg',
			preview: (filePath: string, cb: (html: string) => void) =>
				cb(previewCode(filePath)),
		},
		{
			fileNames: ['binding.gyp'],
			type: 'Node JS C++ Binding',
			thumbnail: () => 'extension/python.svg',
			preview: (filePath: string, cb: (html: string) => void) =>
				cb(previewCode(filePath)),
		},
		{
			fileNames: ['LICENSE', 'LICENSE.md', 'LICENSE.txt'],
			type: 'License',
			thumbnail: () => 'extension/certificate.svg',
			preview: (filePath: string, cb: (html: string) => void) =>
				cb(previewCode(filePath, 'md')),
		},
		{
			fileNames: [
				'copying',
				'copying.md',
				'copying.txt',
				'copyright',
				'copyright.txt',
				'copyright.md',
				'license',
				'license.md',
				'license.txt',
				'licence',
				'licence.md',
				'licence.txt',
			],
			extension: ['cer', 'cert', 'crt'],
			type: 'Certificate',
			thumbnail: () => 'extension/certificate.svg',
		},
		{
			extension: [
				'ini',
				'dlc',
				'dll',
				'config',
				'conf',
				'properties',
				'prop',
				'settings',
				'option',
				'props',
				'toml',
				'prefs',
				'sln.dotsettings',
				'sln.dotsettings.user',
				'cfg',
			],
			fileNames: [
				'.jshintignore',
				'.buildignore',
				'.mrconfig',
				'.yardopts',
				'manifest.mf',
				'.clang-format',
				'.clang-tidy',
			],
			type: 'Settings',
			thumbnail: () => 'extension/settings.svg',
		},
		{
			type: 'Visual Studio',
			extension: [
				'csproj',
				'ruleset',
				'sln',
				'suo',
				'vb',
				'vbs',
				'vcxitems',
				'vcxitems.filters',
				'vcxproj',
				'vcxproj.filters',
			],
			thumbnail: () => 'extension/visualstudio.svg',
		},
		{
			extension: ['go'],
			type: 'Go Program',
			thumbnail: () => 'extension/go.svg',
		},
		{
			extension: ['java', 'jsp'],
			type: 'Java Program',
			thumbnail: () => 'extension/java.svg',
		},
		{
			extension: ['jsx'],
			type: 'React Program',
			thumbnail: () => 'extension/react.svg',
		},
		{
			extension: ['tsx'],
			type: 'Typescript React Program',
			thumbnail: () => 'extension/react_ts.svg',
		},
		{
			extension: ['psd'],
			type: 'Photoshop',
			thumbnail: () => 'extension/psd.svg',
		},
		{
			type: 'Yarn Package Manager',
			fileNames: [
				'.yarnrc',
				'yarn.lock',
				'.yarnclean',
				'.yarn-integrity',
				'yarn-error.log',
				'.yarnrc.yml',
				'.yarnrc.yaml',
			],
		},
	];
};

export { IMAGE_TYPES, VIDEO_TYPES };
export default FileConfig;
