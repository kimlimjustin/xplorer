import formatBytes from '../Functions/filesize';
import DirectoryAPI from '../../Api/directory';
import { updateTheme } from '../Theme/theme';
/**
 * Render file/folder properties into HTML
 * @param {Record<string, unknown>} options - File/folder's properties
 */
const RenderProperties = (options: Record<string, unknown>) => {
	const PROPERTIES_ELEMENT = document.querySelector<HTMLElement>('.properties');
	const PROPERTIES_BODY = PROPERTIES_ELEMENT.querySelector('.properties-body');
	PROPERTIES_ELEMENT.querySelector('.properties-heading-exit').addEventListener('click', () => {
		PROPERTIES_ELEMENT.style.animation = 'close-properties 1s forwards';
	});
	PROPERTIES_ELEMENT.style.animation = 'properties 1s forwards';

	let table: string;
	table = '<table class="properties-table"><tbody>';
	Object.keys(options).forEach((key) => {
		if (options[key] !== '') {
			const value =
				options[key] === 'calculating'
					? `<td class="properties-table-value" data-calculating="size">Calculating...</td>`
					: `<td class="properties-table-value">${options[key]}</td>`;
			table += `<tr><td>${key}</td class="properties-separator"><td>:</td>${value}</tr>`;
		}
	});
	table += '</tbody</table>';
	PROPERTIES_BODY.innerHTML = table;
};
/**
 * Show properties of a file
 * @param {string} filePath - Path of the file to show the properties
 * @returns {void}
 */
const Properties = (filePath: string): void => {
	const fileElement = document.querySelector<HTMLElement>(`[data-path="${escape(filePath)}"]`);

	const size = fileElement.querySelector('.file-size').innerHTML;
	if (fileElement.dataset.realPath) filePath = fileElement.dataset.realPath;
	const createdAt = fileElement.dataset.createdAt;
	const modifiedAt = fileElement.dataset.modifiedAt;
	const accessedAt = fileElement.dataset.accessedAt;
	const fileType = fileElement.querySelector('.file-type').innerHTML;
	const file_attrs = [];
	if (fileElement.dataset.isHidden === 'true') file_attrs.push('Hidden');
	if (fileElement.dataset.isSystem === 'true') file_attrs.push('System file');
	if (fileElement.dataset.isReadonly === 'true') file_attrs.push('Read only');
	const isDirectory = fileElement.dataset.isDir === 'true';
	const file_attr = file_attrs.join(', ');
	if (isDirectory) {
		new DirectoryAPI(filePath).getSize().then((size) => {
			document.querySelector(`[data-calculating="size"]`).innerHTML = formatBytes(size);
		});
	}

	RenderProperties({
		Size: size ? size : 'calculating',
		'File Path': filePath,
		'File Type': fileType,
		'Created At': createdAt,
		'Modified At': modifiedAt,
		'Accessed At': accessedAt,
		'File Attribute': file_attr,
	});
	updateTheme('properties');
};

export default Properties;
