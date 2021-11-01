import Storage from '../../../Api/storage';
import OperationAPI from '../../../Api/operation';
import DirectoryAPI from '../../../Api/directory';
import joinPath from '../../Functions/path/joinPath';
import getBasename from '../../Functions/path/basename';
import getDirname from '../../Functions/path/dirname';
import NormalizeSlash from '../../Functions/path/normalizeSlash';
import FileAPI from '../../../Api/files';
import ConfirmDialog from '../../Prompt/confirm';
import normalizeSlash from '../../Functions/path/normalizeSlash';
const cpy = async (src: string, dest: string) => {
	dest = joinPath(dest, getBasename(src));
	if (NormalizeSlash(getDirname(src)) === NormalizeSlash(dest)) {
		dest += ' - COPY';
	}
	if (await new FileAPI(dest).exists()) {
		if (
			!(await ConfirmDialog(
				'Target file exists',
				'Target directory with the same file name exists, do you want to overwrite it?',
				'No'
			))
		)
			return;
	}
	new OperationAPI(src, dest).copyFile();
};
const Paste = async (target: string): Promise<void> => {
	const clipboard = await Storage.get('clipboard');

	for (const file of clipboard.files) {
		const dirInfo = new DirectoryAPI(file);
		const recuriveCopy = async (_path: string, _target: string) => {
			const subdirInfo = new DirectoryAPI(normalizeSlash(_path));
			if (await subdirInfo.isDir()) {
				(await subdirInfo.getFiles()).files.forEach((subsubdir) =>
					recuriveCopy(
						subsubdir.file_path,
						joinPath(_target, getBasename(_path))
					)
				);
			} else {
				cpy(_path, _target);
			}
		};
		switch (clipboard.command) {
			case 'cp':
				if (await dirInfo.isDir()) {
					recuriveCopy(file, target);
				} else {
					cpy(file, target);
				}
		}
	}
};
export default Paste;
