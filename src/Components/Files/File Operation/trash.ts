import { OperationLog } from '../../Functions/log';
import PromptError from '../../Prompt/error';
import OS from '../../../Service/platform';
import { DeleteFiles, PurgeFiles, RestoreFiles, RestoreFile as RestoreFileAPI } from '../../../Service/trash';
import OperationAPI from '../../../Service/operation';
import ConfirmDialog from '../../Prompt/confirm';
import { reload } from '../../Layout/windowManager';
let platform: string;

/**
 * Restore file/folder from trash
 * @param {string[]} filePath - file you want to restore
 * @returns {Promise<void>}
 */
const Restore = async (filePaths: string[]): Promise<void> => {
	if (!platform) platform = await OS();
	if (platform === 'darwin') return;

	const result = await RestoreFiles(filePaths);
	if (result.request_confirmation) {
		const confirm = await ConfirmDialog('Something went wrong when trying to restore the file/dir', result.message, 'Yes');
		if (!confirm) return;
		RestoreFiles(filePaths, true);
	}
	reload();
};

const Purge = async (filePaths: string[]): Promise<void> => {
	if (!platform) platform = await OS();
	if (platform === 'darwin') return;
	const confirm = await ConfirmDialog(
		'Permanently delete file',
		"Are you sure to permanently delete these files/dirs? This can't be undone.",
		'Yes'
	);
	if (!confirm) return;
	PurgeFiles(filePaths);
	reload();
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
		PromptError('Failed to delete files/dirs', `Failed to move ` + filePaths.join(', ') + ` to trash. [${err}]`);
	}
	if (platform !== 'darwin') {
		OperationLog('delete', filePaths);
	}
};

/**
 * Restore file from trash by known original parent and basename
 * @param {string} original_parent
 * @param {string} basename
 * @returns {Promise<any>}
 */
const RestoreFile = async (original_parent: string, basename: string): Promise<void> => {
	if (!platform) platform = await OS();
	if (platform === 'darwin') return;
	await RestoreFileAPI(original_parent, basename);
};

/**
 * Permanently delete files/folders
 * @param {string[]} filePaths - files you want to permanently delete
 * @returns {void}
 */
const PermanentDelete = async (filePaths: string[]): Promise<void> => {
	const confirm = await ConfirmDialog(
		'Permanently delete file',
		filePaths.length > 1
			? "Are you sure to permanently delete these files/dirs? This can't be undone."
			: "Are you sure to permanently delete this file/dir? This can't be undone.",
		'Yes'
	);
	if (!confirm) return;
	for (const filePath of filePaths) {
		await new OperationAPI(filePath).unlink();
	}
};

export { Trash, PermanentDelete, Restore, Purge, RestoreFile };
