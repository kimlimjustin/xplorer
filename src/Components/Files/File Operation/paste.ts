import Storage from '../../../Service/storage';
import OperationAPI from '../../../Service/operation';
import DirectoryAPI from '../../../Service/directory';
import joinPath from '../../Functions/path/joinPath';
import getBasename from '../../Functions/path/basename';
import getDirname from '../../Functions/path/dirname';
import NormalizeSlash from '../../Functions/path/normalizeSlash';
import FileAPI from '../../../Service/files';
import ConfirmDialog from '../../Prompt/confirm';
import normalizeSlash from '../../Functions/path/normalizeSlash';
import { OperationLog } from '../../Functions/log';
const cpy = async (src: string, dest: string) => {
	dest = joinPath(dest, getBasename(src));
	if (NormalizeSlash(getDirname(src)) === NormalizeSlash(dest)) {
		dest += ' - COPY';
	}
	if (await new FileAPI(dest).exists()) {
		if (!(await ConfirmDialog('Target file exists', 'Target directory with the same file name exists, do you want to overwrite it?', 'No')))
			return;
	}
	new OperationAPI(src, dest).copyFile();
};
const Paste = async (target: string): Promise<void> => {
	const clipboard = await Storage.get('clipboard');

	const recuriveCopy = async (_path: string, _target: string, firstRecursion = false) => {
		let useCopySuffix = false;
		if (firstRecursion && normalizeSlash(getDirname(_path)) === normalizeSlash(_target)) {
			useCopySuffix = true;
		}
		const subdirInfo = new DirectoryAPI(normalizeSlash(_path));
		if (await subdirInfo.isDir()) {
			let _dest = joinPath(_target, getBasename(_path));
			if (useCopySuffix) _dest += '- COPY';
			await new DirectoryAPI(_dest).mkdir();
			(await subdirInfo.getFiles()).files.forEach(async (subsubdir) => {
				await recuriveCopy(subsubdir.file_path, _dest);
			});
		} else {
			cpy(_path, _target);
		}
	};
	for (const file of clipboard.files) {
		const dirInfo = new DirectoryAPI(file);
		const dest = joinPath(target, getBasename(file));
		switch (clipboard.command) {
			case 'cp':
				if (await dirInfo.isDir()) {
					await recuriveCopy(file, target, true);
				} else {
					cpy(file, target);
				}
				break;
			case 'cut':
				if (await new DirectoryAPI(dest).exists()) {
					if (
						!(await ConfirmDialog(
							'Target file exists',
							'Target directory with the same file/dir name exists, do you want to overwrite it?',
							'No'
						))
					)
						return;
					else {
						await new OperationAPI(dest).unlink();
					}
				}
				await new OperationAPI(file, dest).cut();
				break;
		}
	}
	switch (clipboard.command) {
		case 'cp':
			OperationLog('copy', clipboard.files, target);
			break;
		case 'cut':
			OperationLog('cut', clipboard.files, target);
			break;
	}
};
export default Paste;
