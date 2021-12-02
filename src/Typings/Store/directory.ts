import FileMetaData from "../fileMetaData";

export interface IDirectoryMeta {
  files: FileMetaData[],
  num_files: number,
  skipped_files: string[]
}

export interface IDirectoryState {
  dir_name: string,
  parent_dir: string,
  files: Record<string, FileMetaData>
};
