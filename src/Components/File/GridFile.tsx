import React from 'react';
import FileMetaData from "../../Typings/fileMetaData";

export interface IGridFileProps {
  size: number,
  metadata: FileMetaData,
  handleFileDoubleClick: (isDir: boolean, dirName: string) => void
}

const GridFile = ({ size, metadata, handleFileDoubleClick }: IGridFileProps): JSX.Element => {
  return (
    <button
      type="button"
      onDoubleClick={() => handleFileDoubleClick(!!metadata.is_dir, metadata.basename)}
      style={{ width: size, minHeight: size }}
      className="gridfile-container"
    >
      <span>Icon</span>
      <p style={{ wordWrap: 'break-word', margin: 0 }}>{metadata.basename}</p>
    </button>
  );
};

export default GridFile;
