import React from 'react';
import { useDispatch, useSelector } from 'react-redux';

import GridFile from "./GridFile";
import DetailFile from "./DetailFile";

import { getStandardPath } from '../../Helpers/paths';
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

  const handleFileDoubleClick = (isDir: boolean, fileName: string) => {
    if (!isDir) {
      console.log('TODO: Handle open file', fileName); // TODO COMPLETE
      return;
    }

    dispatch(setActiveTab({
      ...activeTab,
      path: getStandardPath(`${activeTab.path}${fileName}`)
    }));
  };

  switch (mode) {
    case 'GridLarge':
      return <GridFile size={96} metadata={metadata} handleFileDoubleClick={handleFileDoubleClick} />;
    case 'GridMedium':
      return <GridFile size={72} metadata={metadata} handleFileDoubleClick={handleFileDoubleClick} />;
    case 'GridSmall':
      return <GridFile size={48} metadata={metadata} handleFileDoubleClick={handleFileDoubleClick} />;
    case 'Detail':
      return <DetailFile metadata={metadata} handleFileDoubleClick={handleFileDoubleClick} />;
    default:
      return (<div>File mode not supported</div>);
  }
};

export default File;
