import React from 'react';
import FileMetaData from '../../Typings/fileMetaData';

export interface IDetailFileProps {
  metadata: FileMetaData,
  handleFileDoubleClick: (isDir: boolean, dirName: string) => void
}

const DetailFile = ({ metadata, handleFileDoubleClick }: IDetailFileProps): JSX.Element => {
  return (
    <button
      className="detailfile-container"
      type="button"
      onDoubleClick={() => handleFileDoubleClick(!!metadata.is_dir, metadata.basename)}
      style={{
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%'
      }}
    >
      <p>{metadata.basename}</p>
      <p>{metadata.created ? new Date(metadata.created.secs_since_epoch * 1000).toDateString() : null}</p>
      <p>{metadata.size}</p>
      <p>{metadata.file_type}</p>
    </button>
  );
};

export default DetailFile;
