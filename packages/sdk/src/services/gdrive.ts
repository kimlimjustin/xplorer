import { transport } from '../transport';
import type { FileEntry } from '../types';

export const gdriveAuthenticate = async (): Promise<{
  id: string;
  email: string;
  display_name: string;
}> => {
  return await transport('gdrive_authenticate');
};

export const gdriveDisconnect = async (accountId: string): Promise<void> => {
  return await transport('gdrive_disconnect', { accountId });
};

export const gdriveListAccounts = async (): Promise<
  Array<{ id: string; email: string; display_name: string }>
> => {
  return await transport('gdrive_list_accounts');
};

export const gdriveListFiles = async (
  accountId: string,
  folderId: string,
): Promise<FileEntry[]> => {
  return await transport('gdrive_list_files', { accountId, folderId });
};

export const gdriveDownloadFile = async (
  accountId: string,
  fileId: string,
  localPath: string,
): Promise<void> => {
  return await transport('gdrive_download_file', { accountId, fileId, localPath });
};

export const gdriveUploadFile = async (
  accountId: string,
  localPath: string,
  parentFolderId: string,
): Promise<FileEntry> => {
  return await transport('gdrive_upload_file', { accountId, localPath, parentFolderId });
};

export const gdriveDeleteFile = async (accountId: string, fileId: string): Promise<void> => {
  return await transport('gdrive_delete_file', { accountId, fileId });
};

export const gdriveRenameFile = async (
  accountId: string,
  fileId: string,
  newName: string,
): Promise<void> => {
  return await transport('gdrive_rename_file', { accountId, fileId, newName });
};

export const gdriveMoveFile = async (
  accountId: string,
  fileId: string,
  newParentId: string,
  oldParentId: string,
): Promise<void> => {
  return await transport('gdrive_move_file', { accountId, fileId, newParentId, oldParentId });
};

export const gdriveCreateFolder = async (
  accountId: string,
  name: string,
  parentFolderId: string,
): Promise<FileEntry> => {
  return await transport('gdrive_create_folder', { accountId, name, parentFolderId });
};

export const gdriveGetFileContent = async (accountId: string, fileId: string): Promise<string> => {
  return await transport('gdrive_get_file_content', { accountId, fileId });
};

export const getGdriveSettings = async (): Promise<{
  client_id: string;
  client_secret: string;
}> => {
  return await transport('get_gdrive_settings');
};

export const updateGdriveSettings = async (
  clientId: string,
  clientSecret: string,
): Promise<void> => {
  return await transport('update_gdrive_settings', { clientId, clientSecret });
};
