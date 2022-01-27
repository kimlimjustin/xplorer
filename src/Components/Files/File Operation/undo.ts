import windowName from '../../../Service/window';
import OperationAPI from '../../../Service/operation';
import Storage from '../../../Service/storage';
import joinPath from '../../Functions/path/joinPath';
import getBasename from '../../Functions/path/basename';
import FileAPI from '../../../Service/files';
import ConfirmDialog from '../../Prompt/confirm';
import DirectoryAPI from '../../../Service/directory';
import { RestoreFile } from './trash';
import getDirname from '../../Functions/path/dirname';
import NormalizeSlash from '../../Functions/path/normalizeSlash';
/**
 * Undo the latest operation
 * @returns {Promise<void>}
 */
const Undo = async (): Promise<void> => {
	const operationLogs = await Storage.get(`operations-${windowName}`);
	const latestOperation = operationLogs?.operations[operationLogs?.currentIndex];
	switch (latestOperation?.operationType) {
		case 'copy':
			for (const source of latestOperation.sources) {
				const filename = joinPath(latestOperation.destination, getBasename(source));
				const filenameWithCopySuffix = `${filename
					.split('.')
					.splice(0, filename.split('.').length - 1)
					.join('.')} - Copy.${filename.split('.').splice(filename.split('.').length - 1)}`;
				const copiedFile = (await new FileAPI(filenameWithCopySuffix).exists()) ? filenameWithCopySuffix : filename;
				new OperationAPI(copiedFile).unlink();
			}
			break;
		case 'cut':
			for (const source of latestOperation.sources) {
				const dest = joinPath(latestOperation.destination, getBasename(source));
				if (await new DirectoryAPI(source).exists()) {
					if (
						!(await ConfirmDialog(
							'Target file exists',
							'Target directory with the same file/dir name exists, do you want to overwrite it?',
							'No'
						))
					)
						return;
					else {
						await new OperationAPI(source).unlink();
					}
				}
				await new OperationAPI(dest, source).rename();
				break;
			}
			break;
		case 'newfile':
			new OperationAPI(latestOperation.destination).unlink();
			break;
		case 'newfolder':
			new OperationAPI(latestOperation.destination).unlink();
			break;
		case 'delete':
			for (const source of latestOperation.sources) {
				RestoreFile(NormalizeSlash(getDirname(source)), NormalizeSlash(getBasename(source)));
			}
			break;
		case 'rename':
			await new OperationAPI(latestOperation.destination, latestOperation.sources).rename();
			break;
	}
	if (operationLogs.currentIndex > -1) operationLogs.currentIndex -= 1;
	Storage.set(`operations-${windowName}`, operationLogs);
};

export default Undo;
