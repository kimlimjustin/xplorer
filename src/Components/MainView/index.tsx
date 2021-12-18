import React from 'react';
import { useSelector } from 'react-redux';

import { IAppState } from '../../Store/Reducers';
import { IFile } from '../../Typings/Store/files';

export interface IMainViewProps {
  currentDirectory: string
}

const MainView = ({ currentDirectory }: IMainViewProps) => {
  const files = useSelector<IAppState, IAppState["files"]["files"]>((state) => state.files.files);

  const sortFiles = (a: IFile, b: IFile): number => {
    if ((!a.is_dir && b.is_dir) || (a.is_dir && !b.is_dir)) return (b.is_dir ? 1 : -1); // Simulates xor for is_dir property
    return (a.basename || '' > b.basename || '' ? 1 : -1)
  };

  return (
    <div className="main-box">
      <div id="workspace">
        {Object.values(files)
          .sort(sortFiles)
          .reduce<Partial<JSX.Element>[]>(
            (accum, { file_path = '', basename = '', is_dir = false }) => {
              const parentDirectory = file_path.substring(0, file_path.length - basename.length);
              if (parentDirectory !== currentDirectory) return accum;
              return ([...accum, (
                <p key={basename}>{`${is_dir ? '/' : ''}${basename}`}</p>
              )]);
            }, []
          )}
      </div>
    </div>
  );
}

export default MainView;
