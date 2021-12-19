import React, { MouseEvent } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import GridFile from "./GridFile";
import DetailFile from "./DetailFile";

import { getStandardPath } from '../../Helpers/paths';
import { openFileRequest, openFilePreview } from '../../Store/ActionCreators/FilesActionCreators';
import { setActiveTab } from '../../Store/ActionCreators/TabActionCreators';
import { IAppState } from '../../Store/Reducers';
import FileMetaData from "../../Typings/fileMetaData";

export type FileDisplayMode = "GridLarge" | "GridMedium" | "GridSmall" | "Detail";

export interface IFileProps {
  mode: FileDisplayMode,
  metadata: FileMetaData
}

export const File = ({ mode, metadata }: IFileProps): JSX.Element => {
  const dispatch = useDispatch();
  const activeTab = useSelector<IAppState, IAppState['tabs']['activeTab']>(state => state.tabs.activeTab);

  const handleFileRightClick = (
    e: MouseEvent<HTMLButtonElement, globalThis.MouseEvent>,
    path: string
  ) => {
    e.preventDefault();
    dispatch(openFilePreview(path));
  };

  const handleFileDoubleClick = (isDir: boolean, fileName: string) => {
    if (!isDir) {
      dispatch(openFileRequest(fileName));
      return;
    }

    dispatch(setActiveTab({
      ...activeTab,
      path: getStandardPath(`${activeTab.path}${fileName}`)
    }));
  };

  switch (mode) {
    case 'GridLarge':
      return (
        <GridFile
          size={96}
          metadata={metadata}
          handleFileRightClick={handleFileRightClick}
          handleFileDoubleClick={handleFileDoubleClick}
        />
      );
    case 'GridMedium':
      return (
        <GridFile
          size={72}
          metadata={metadata}
          handleFileRightClick={handleFileRightClick}
          handleFileDoubleClick={handleFileDoubleClick}
        />
      );
    case 'GridSmall':
      return (
        <GridFile
          size={48}
          metadata={metadata}
          handleFileRightClick={handleFileRightClick}
          handleFileDoubleClick={handleFileDoubleClick}
        />
      );
    case 'Detail':
      return (
        <DetailFile
          metadata={metadata}
          handleFileRightClick={handleFileRightClick}
          handleFileDoubleClick={handleFileDoubleClick}
        />
      );
    default:
      return (
        <div>
          File mode not supported
        </div>
      );
  }
};

export default File;
