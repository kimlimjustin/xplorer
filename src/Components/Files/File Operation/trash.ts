import { OperationLog } from '../../Functions/log';
import PromptError from '../../Prompt/error';
import OS from '../../../Api/platform';
import { DeleteFiles } from '../../../Api/trash';
import OperationAPI from '../../../Api/operation';
import ConfirmDialog from '../../Prompt/confirm';
let platform: string;

/**
 * Restore file/folder from trash
 * @param {string} filePath - file you want to restore
 * @returns {void}
 */
/*const Restore = (filePath: string): void => {
	let fileInfo;
	let __uuid;
	if (
		fs.existsSync(
			path.join(INFO_PATH, path.basename(filePath) + '.trashinfo')
		)
	) {
		fileInfo = fs.readFileSync(
			path.join(INFO_PATH, path.basename(filePath) + '.trashinfo'),
			'utf8'
		);
	} else {
		fs.readdirSync(INFO_PATH).forEach((info) => {
			if (
				unescape(
					fs
						.readFileSync(path.join(INFO_PATH, info), 'utf-8')
						.split('\n')[1]
						.split('=')[1]
				) === filePath
			) {
				fileInfo = fs.readFileSync(path.join(INFO_PATH, info), 'utf-8');
				__uuid = info
					.split('.')
					.splice(0, info.split('.').length - 1)
					.join('.');
			}
		});
	}
	const trashSourcePath = fileInfo.split('\n')[1].split('=')[1];
	mv(
		path.join(FILES_PATH, __uuid ?? path.basename(filePath)),
		unescape(trashSourcePath),
		(err) => {
			if (err) ErrorLog(err);
		}
	);
	fs.unlink(
		path.join(
			INFO_PATH,
			__uuid
				? __uuid + '.trashinfo'
				: path.basename(filePath) + '.trashinfo'
		),
		(err) => {
			if (err) ErrorLog(err);
		}
	);
};

/**
 * Move file/folder into trash
 * @param {string[]} filePaths - files you want to delete
 * @returns {Promise<void>}
 */
const Trash = async (filePaths: string[]): Promise<void> => {
	if (!platform) platform = await OS();
	try {
		DeleteFiles(filePaths);
	} catch (err) {
		PromptError(
			'Failed to delete files/dirs',
			`Failed to move ` + filePaths.join(', ') + ` to trash. [${err}]`
		);
	}
	if (platform !== 'darwin') {
		OperationLog('delete', filePaths);
	}
};

/**
 * Permanently delete files/folders
 * @param {string[]} filePaths - files you want to permanently delete
 * @returns {void}
 */
const PermanentDelete = async (filePaths: string[]): Promise<void> => {
	for (const filePath of filePaths) {
		const confirm = await ConfirmDialog(
			'Permanently delete file',
			"Are you sure to permanently delete this file/dir? This can't be undone.",
			'Yes'
		);
		if (!confirm) return;
		await new OperationAPI(filePath).unlink();
	}
};

export { Trash, PermanentDelete };
