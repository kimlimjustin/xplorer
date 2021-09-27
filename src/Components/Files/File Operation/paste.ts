import { clipboard, ipcRenderer } from 'electron';
import path from 'path';
import fs from 'fs';
import cpy from 'cpy';
import { dialog } from '@electron/remote';
import { ErrorLog, InfoLog, OperationLog } from '../../Functions/log';
import { reload } from '../../Layout/windowManager';
import mv from 'mv';

/**
 * copy a file
 * @param {Array<string>} filePaths - array of file paths to be copied
 * @param {string} target - desitnation of copying file
 * @returns {Promise<void>}
 */
const COPY = (filePaths: Array<string>, target: string): Promise<void> => {
	const operationDone = (filePath: string) => {
		ipcRenderer.sendSync(
			'operation-done',
			path.join(target, path.basename(filePath))
		);
		reload();
	};
	return new Promise<void>((resolve) => {
		for (const filePath of filePaths) {
			const copyAFileDone = (file: string) => {
				operationDone(filePath);
				if (file !== filePaths[filePaths.length - 1]) return;
				else {
					resolve();
				}
			};
			ipcRenderer.send(
				'operation',
				path.join(target, path.basename(filePath))
			);
			if (fs.lstatSync(filePath).isDirectory()) {
				if (target === path.dirname(filePath)) {
					cpy(
						filePath,
						path.join(target, path.basename(filePath) + ' - Copy')
					).then(() => {
						copyAFileDone(filePath);
					});
				} else if (
					fs.existsSync(path.join(target, path.basename(filePath)))
				) {
					const options = {
						buttons: ['Replace', 'Skip'],
						message: `Another folder with the same name already exists in "${target}". Replacing it will overwrite its content.`,
						title: `Replace folder ${path.basename(filePath)}`,
					};
					if (dialog.showMessageBoxSync(options) === 0)
						cpy(
							filePath,
							path.join(target, path.basename(filePath))
						).then(() => {
							copyAFileDone(filePath);
						});
				} else {
					cpy(
						filePath,
						path.join(target, path.basename(filePath))
					).then(() => {
						copyAFileDone(filePath);
					});
				}
			} else {
				if (target === path.dirname(filePath)) {
					cpy(filePath, target, {
						rename: (basename) =>
							`${basename
								.split('.')
								.splice(0, basename.split('.').length - 1)
								.join('.')} - Copy.${basename
								.split('.')
								.splice(basename.split('.').length - 1)}`,
					}).then(() => {
						copyAFileDone(filePath);
					});
				} else if (
					fs.existsSync(path.join(target, path.basename(filePath)))
				) {
					const options = {
						buttons: ['Replace', 'Skip'],
						message: `Another file with the same name already exists in "${target}". Replacing it will overwrite its content.`,
						title: `Replace file ${path.basename(filePath)}`,
					};
					if (dialog.showMessageBoxSync(options) === 0)
						cpy(filePath, target).then(() => {
							copyAFileDone(filePath);
						});
				} else {
					cpy(filePath, target).then(() => {
						copyAFileDone(filePath);
					});
				}
			}
		}
	});
};

/**
 * Paste copied files into a folder
 * @param {string} target - Folder you want to paste copied files into
 * @returns {void}
 */
const Paste = async (target: string): Promise<void> => {
	const clipboardText = clipboard.readText();
	let clipboardExFilePaths;
	if (process.platform !== 'linux') {
		const clipboardEx = require('electron-clipboard-ex'); //eslint-disable-line
		clipboardExFilePaths = clipboardEx.readFilePaths();
	}
	if (clipboardExFilePaths?.length) {
		await COPY(clipboardExFilePaths, target);
		InfoLog(`Copy ${clipboardExFilePaths.length} files into ${target}`);
		OperationLog('copy', clipboardExFilePaths, target);
	}
	// CHeck if the copied text is Xplorer command
	else if (!clipboardText.startsWith('Xplorer command')) {
		return;
	} else {
		const commandType = clipboardText
			.split('\n')[0]
			.replace('Xplorer command - ', '');
		const filePaths: string[] = [];
		for (let i = 1; i < clipboardText.split('\n').length; i++) {
			filePaths.push(clipboardText.split('\n')[i]);
		}
		if (commandType === 'COPY') {
			await COPY(filePaths, target);
			InfoLog(`Copy ${filePaths.length} files into ${target}`);
			OperationLog('copy', filePaths, target);
		} else if (commandType === 'CUT') {
			for (const filePath of filePaths) {
				mv(
					filePath,
					path.join(target, path.basename(filePath)),
					(err) => {
						if (err) {
							dialog.showMessageBoxSync({
								message:
									'Something went wrong, please try again or open an issue on GitHub.',
								type: 'error',
							});
							ErrorLog(err);
						}
					}
				);
			}
			InfoLog(`Cut ${filePaths.length} files into ${target}`);
			OperationLog('cut', filePaths, target);
		}
	}
};

export default Paste;
