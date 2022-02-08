import formatBytes from '../Functions/filesize';
import DirectoryAPI from '../../Service/directory';
import FileAPI from '../../Service/files';
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
const Properties = async (filePath: string): Promise<void> => {
	const fileElement = document.querySelector<HTMLElement>(`[data-path="${encodeURI(filePath)}"]`);

	let size, createdAt, modifiedAt, accessedAt, fileType, isHidden, isSystem, isReadonly;

	if (fileElement.classList.contains('file')) {
		size = fileElement.querySelector('.file-size').innerHTML;
		if (fileElement.dataset.realPath) filePath = fileElement.dataset.realPath;
		createdAt = fileElement.dataset.createdAt;
		modifiedAt = fileElement.dataset.modifiedAt;
		accessedAt = fileElement.dataset.accessedAt;
		fileType = fileElement.querySelector('.file-type').innerHTML;
		isHidden = fileElement.dataset.isHidden === 'true';
		isSystem = fileElement.dataset.isSystem === 'true';
		isReadonly = fileElement.dataset.isReadonly === 'true';
	} else {
		const fileInfo = await new FileAPI(filePath).properties();
		size = formatBytes(fileInfo.size);
		createdAt = String(new Date(fileInfo.created.secs_since_epoch * 1000).toLocaleString(navigator.language, { hour12: false }));
		modifiedAt = String(new Date(fileInfo.last_modified.secs_since_epoch * 1000).toLocaleString(navigator.language, { hour12: false }));
		accessedAt = String(new Date(fileInfo.last_accessed.secs_since_epoch * 1000).toLocaleString(navigator.language, { hour12: false }));
		isHidden = fileInfo.is_hidden;
		isSystem = fileInfo.is_system;
		isReadonly = fileInfo.readonly;
		fileType = 'File Folder';
	}
	const file_attrs = [];
	if (isHidden) file_attrs.push('Hidden');
	if (isSystem) file_attrs.push('System file');
	if (isReadonly) file_attrs.push('Read only');
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
};

export default Properties;
