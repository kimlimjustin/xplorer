import path from 'path';
import fs from 'fs';
import os from 'os';
import { ErrorLog, OperationLog } from '../../Functions/log';
import trash from 'trash';
import { v4 } from 'uuid';
import mv from 'mv';
import { dialog } from '@electron/remote';
const UNIX_TRASH_FILES_PATH = path.join(
	os.homedir(),
	'.local/share/Trash/files'
);
const UNIX_TRASH_INFO_PATH = path.join(os.homedir(), '.local/share/Trash/info');
const WINDOWS_TRASH_FILES_PATH = 'C:\\Trash/files';
const WINDOWS_TRASH_INFO_PATH = 'C:\\Trash/info';
const FILES_PATH =
	process.platform === 'win32'
		? WINDOWS_TRASH_FILES_PATH
		: UNIX_TRASH_FILES_PATH;
const INFO_PATH =
	process.platform === 'win32'
		? WINDOWS_TRASH_INFO_PATH
		: UNIX_TRASH_INFO_PATH;

/**
 * Restore file/folder from trash
 * @param {string} filePath - file you want to restore
 * @returns {void}
 */
const Restore = (filePath: string): void => {
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

const pad = (number: number) => (number < 10 ? '0' + number : number);

const getDeletionDate = (date: Date) =>
	date.getFullYear() +
	'-' +
	pad(date.getMonth() + 1) +
	'-' +
	pad(date.getDate()) +
	'T' +
	pad(date.getHours()) +
	':' +
	pad(date.getMinutes()) +
	':' +
	pad(date.getSeconds());

/**
 * Move file/folder into trash
 * @param {string[]} filePaths - files you want to delete
 * @returns {void}
 */
const Trash = (filePaths: string[]): void => {
	for (const filePath of filePaths) {
		if (process.platform === 'win32') {
			const name = v4();
			const destination = path.join(WINDOWS_TRASH_FILES_PATH, name);
			const trashInfoPath = path.join(
				WINDOWS_TRASH_INFO_PATH,
				`${name}.trashinfo`
			);
			if (!fs.existsSync(WINDOWS_TRASH_FILES_PATH)) {
				fs.mkdirSync(WINDOWS_TRASH_FILES_PATH, { recursive: true });
			}
			if (!fs.existsSync(WINDOWS_TRASH_INFO_PATH)) {
				fs.mkdirSync(WINDOWS_TRASH_INFO_PATH, { recursive: true });
			}
			mv(filePath, destination, (err) => {
				if (err) ErrorLog(err);
			});
			const trashInfoData = `[Trash Info]\nPath=${filePath.replace(
				/\s/g,
				'%20'
			)}\nDeletionDate=${getDeletionDate(new Date())}`;
			fs.writeFileSync(trashInfoPath, trashInfoData);
		} else {
			if (process.platform === 'darwin') {
				const name = v4();
				const destination = path.join(UNIX_TRASH_FILES_PATH, name);
				const trashInfoPath = path.join(
					UNIX_TRASH_INFO_PATH,
					`${name}.trashinfo`
				);
				if (!fs.existsSync(UNIX_TRASH_FILES_PATH)) {
					fs.mkdirSync(UNIX_TRASH_FILES_PATH, { recursive: true });
				}
				if (!fs.existsSync(UNIX_TRASH_INFO_PATH)) {
					fs.mkdirSync(UNIX_TRASH_INFO_PATH, { recursive: true });
				}
				mv(filePath, destination, (err) => {
					if (err) ErrorLog(err);
				});
				const trashInfoData = `[Trash Info]\nPath=${filePath.replace(
					/\s/g,
					'%20'
				)}\nDeletionDate=${getDeletionDate(new Date())}`;
				fs.writeFileSync(trashInfoPath, trashInfoData);
			} else trash(filePath);
		}
	}
	OperationLog('delete', filePaths);
};

/**
 * Permanently delete files/folders
 * @param {string[]} filePaths - files you want to permanently delete
 * @returns {void}
 */
const PermanentDelete = (filePaths: string[]): void => {
	const options = {
		buttons: ['Yes', 'No'],
		message: `Are you sure to permanently delete ${
			filePaths.length > 1 ? 'these files/folders' : 'this file/folder'
		}?`,
		title: `Delete file/folder`,
	};
	if (dialog.showMessageBoxSync(options) === 0) {
		for (const filePath of filePaths) {
			if (fs.statSync(filePath).isDirectory()) {
				fs.rmdirSync(filePath, { recursive: true });
			} else {
				fs.unlink(filePath, (err) => {
					if (err) ErrorLog(err);
				});
			}
			if (
				fs.existsSync(
					path.join(INFO_PATH, path.basename(filePath) + '.trashinfo')
				)
			) {
				fs.unlink(
					path.join(
						INFO_PATH,
						path.basename(filePath) + '.trashinfo'
					),
					(err) => {
						if (err) ErrorLog(err);
					}
				);
			}
		}
	}
};

export { Restore, Trash, PermanentDelete };
