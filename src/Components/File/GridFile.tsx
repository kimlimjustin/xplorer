import React, { MouseEvent } from "react";
import FileMetaData from "../../Typings/fileMetaData";

export interface IGridFileProps {
    size: number;
    metadata: FileMetaData;
    handleFileRightClick: (e: MouseEvent<HTMLButtonElement, globalThis.MouseEvent>, path: string) => void;
    handleFileDoubleClick: (isDir: boolean, dirName: string) => void;
}

const GridFile = ({ size, metadata, handleFileRightClick, handleFileDoubleClick }: IGridFileProps): JSX.Element => {
    return (
        <button
            type="button"
            onContextMenu={(e) => handleFileRightClick(e, metadata.file_path)}
            onDoubleClick={() => handleFileDoubleClick(!!metadata.is_dir, metadata.file_path)}
            style={{ width: size, minHeight: size }}
            className="gridfile-container"
        >
            <span>Icon</span>
            <p style={{ wordWrap: "break-word", margin: 0 }}>{metadata.basename}</p>
        </button>
    );
};

export default GridFile;
