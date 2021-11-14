import { URLify, eURLify } from '../Components/Functions/urlify';

interface FileConfigType {
	extension?: string[];
	fileNames?: string[];
	preview?: (filePath: string, cb: (html: string) => void) => void;
}

const IMAGE_TYPES = ['jpg', 'png', 'gif', 'bmp', 'jpeg', 'jpe', 'jif', 'jfif', 'jfi', 'webp', 'tiff', 'tif', 'ico', 'svg', 'webp'];
const VIDEO_TYPES = ['mp4', 'webm', 'mpg', 'mp2', 'mpeg', 'mpe', 'mpv', 'ocg', 'm4p', 'm4v', 'avi', 'wmv', 'mov', 'qt', 'flv', 'swf'];

const previewCode = (filePath: string, language?: string) => {
	const hljs = require('highlight.js');
	/*const highlightedCode = language
		? hljs.highlight(fs.readFileSync(filePath, 'utf8'), {
				language: language,
		  }).value //eslint-disable-line no-mixed-spaces-and-tabs
		: hljs.highlightAuto(fs.readFileSync(filePath, 'utf8')).value;*/
	return `<pre class='preview-object' data-type="code"><code></code></pre>`;
	//return `<pre class='preview-object' data-type="code"><code>${highlightedCode}</code></pre>`;
};

const FileConfig = (): FileConfigType[] => {
	return [
		{
			extension: ['js'],
			preview: (filePath: string, cb: (html: string) => void) => cb(previewCode(filePath, 'javascript')),
		},
		{
			extension: ['ts'],
			preview: (filePath: string, cb: (html: string) => void) => cb(previewCode(filePath, 'typescript')),
		},
		{
			extension: ['html', 'htm', 'xhtml', 'html_vm', 'asp'],
			preview: (filePath: string, cb: (html: string) => void) =>
				cb(`<iframe src="${filePath}" title="${filePath}" class="preview-object"></iframe>`),
		},
		{
			extension: ['pdf'],
			preview: (filePath: string, cb: (html: string) => void) => {
				cb(
					`<object data="${filePath}#toolbar=0" type="application/pdf" class="preview-object"><embed src="${filePath}#toolbar=0" type="application/pdf" /></object>`
				);
			},
		},
		{
			extension: ['doc', 'docb', 'docm', 'dot', 'dotm', 'docx', 'rtf'],
			preview: (filePath: string, cb: (html: string) => void) => {
				if (filePath.endsWith('docx')) {
					/*const mammoth = require('mammoth');
					mammoth
						.convertToHtml({ path: filePath })
						.then(({ value }: { value: string }) => {
							cb(
								eURLify(
									`<div class='preview-object' data-type="docx">${value}</div>`
								)
							);
						});*/
					cb('hello');
				}
			},
		},
		{
			extension: ['xlsx', 'xls', 'xlsb', 'xls', 'ods', 'fods', 'csv'],
			preview: (filePath: string, cb: (html: string) => void) => {
				const XLSX = require('xlsx');
				const xlsxData = XLSX.readFile(filePath);
				const parsedData = XLSX.utils.sheet_to_html(xlsxData.Sheets[xlsxData.SheetNames[0]]);
				cb(`<div class='preview-object' data-type="xlsx">${URLify(parsedData)}</div>`);
			},
		},
		{
			extension: ['bat'],
			preview: (filePath: string, cb: (html: string) => void) => cb(previewCode(filePath, 'bat')),
		},
		{
			extension: ['cc', 'cpp', 'cxx', 'c++', 'cp', 'mm', 'mii', 'ii'],
			preview: (filePath: string, cb: (html: string) => void) => cb(previewCode(filePath, 'c++')),
		},
		{
			extension: ['c'],
			preview: (filePath: string, cb: (html: string) => void) => cb(previewCode(filePath, 'c')),
		},
		{
			extension: ['h'],
			preview: (filePath: string, cb: (html: string) => void) => cb(previewCode(filePath, 'c')),
		},
		{
			extension: ['py', 'py3'],
			preview: (filePath: string, cb: (html: string) => void) => cb(previewCode(filePath, 'python')),
		},
		{
			extension: ['txt'],
			preview: (filePath: string, cb: (html: string) => void) => {
				cb(
					'<div class="preview-object"></div>'
					/*`<div class='preview-object' data-type="txt">${fs
						.readFileSync(filePath, 'utf8')
						.replaceAll('\n', '<br />')}</div>`*/
				);
			},
		},
		{
			extension: IMAGE_TYPES,
			preview: (filePath: string, cb: (html: string) => void) =>
				cb(`<div class="preview-object" data-type="img"><img src="${filePath}" data-path="${filePath}" /></div>`),
		},
		{
			extension: VIDEO_TYPES,
			preview: (filePath: string, cb: (html: string) => void) =>
				cb(`<div class="preview-object" data-type="video"><video controls=""><source src="${filePath}"></video></div>`),
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
			preview: (filePath: string, cb: (html: string) => void) => cb(previewCode(filePath, 'docker')),
		},
		{
			extension: ['md', 'markdown', 'rst'],
			preview: (filePath: string, cb: (html: string) => void) => cb(previewCode(filePath, 'md')),
		},
		{
			extension: ['json', 'tsbuildinfo', 'json5', 'jsonl', 'ndjson'],
			preview: (filePath: string, cb: (html: string) => void) => {
				cb(previewCode(filePath, 'json'));
			},
		},
		{
			fileNames: ['.gitignore', '.gitignore_global', '.gitconfig', '.gitattributes', '.gitmodules', '.gitkeep', 'git-history'],
			preview: (filePath: string, cb: (html: string) => void) => cb(previewCode(filePath)),
		},
		{
			extension: ['yml', 'yaml'],
			preview: (filePath: string, cb: (html: string) => void) => cb(previewCode(filePath, 'yml')),
		},
		{
			fileNames: ['.prettierignore', '.prettierrc.json'],
			preview: (filePath: string, cb: (html: string) => void) => cb(previewCode(filePath)),
		},
		{
			fileNames: ['binding.gyp'],
			preview: (filePath: string, cb: (html: string) => void) => cb(previewCode(filePath)),
		},
		{
			fileNames: ['LICENSE', 'LICENSE.md', 'LICENSE.txt'],
			preview: (filePath: string, cb: (html: string) => void) => cb(previewCode(filePath, 'md')),
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
			preview: (filePath: string, cb: (html: string) => void) => cb(previewCode(filePath)),
		},
		{
			extension: ['go'],
			preview: (filePath: string, cb: (html: string) => void) => cb(previewCode(filePath, 'go')),
		},
		{
			extension: ['java', 'jsp'],
			preview: (filePath: string, cb: (html: string) => void) => cb(previewCode(filePath, 'java')),
		},
		{
			extension: ['jsx'],
			preview: (filePath: string, cb: (html: string) => void) => cb(previewCode(filePath, 'jsx')),
		},
		{
			extension: ['tsx'],
			preview: (filePath: string, cb: (html: string) => void) => cb(previewCode(filePath, 'tsx')),
		},
		{
			fileNames: ['.yarnrc', 'yarn.lock', '.yarnclean', '.yarn-integrity', 'yarn-error.log', '.yarnrc.yml', '.yarnrc.yaml'],
			preview: (filePath: string, cb: (html: string) => void) => cb(previewCode(filePath)),
		},
	];
};

export { IMAGE_TYPES, VIDEO_TYPES };
export default FileConfig;
