import FileMetaData from "../fileMetaData";

export interface TrashData {
  files: FileMetaData[],
}

export interface FileTrashMeta {
  status: boolean,
  message: string,
  request_confirmation: boolean
}
