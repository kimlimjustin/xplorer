import React, { useState, FormEvent } from 'react';
import { useDispatch } from 'react-redux';

import SubHeader from './SubHeader';
import { getStandardPath } from '../../Helpers/paths';
import { fetchFilesRequest } from '../../Store/ActionCreators/DirectoryActionCreators';

export interface ITab {
  name: string,
  path: string
}

export interface IHeaderProps {
  currentDirectory: string,
  setCurrentDirectory: (dir: string) => void
}

const Header = ({ currentDirectory, setCurrentDirectory }: IHeaderProps) => {
  const dispatch = useDispatch();

  const [tabs, setTabs] = useState<ITab[]>([{ name: "Home", path: currentDirectory }]);
  const [activeTab, setActiveTab] = useState<ITab>(tabs[0]);

  // ! IN PROGRESS - INCOMPLETE
  // const createNewTab = () => {
  //   console.log('new tab created');
  //   const newTab = { name: "Home", path: currentDirectory };
  //   setTabs([...tabs, newTab]);
  //   setActiveTab(newTab);
  // }

  const handlePathChange = (tab: ITab) => (e: FormEvent) => {
    e.preventDefault();
    const path = getStandardPath(tab.path);
    setActiveTab({ ...tab, path });
    setCurrentDirectory(path);
    dispatch(fetchFilesRequest(path));
  }

  return (
    <div id="header-container" className="topbar" data-tauri-drag-region>
      <div className="row">
        <div className="tabs-manager">
          {tabs.map((tab) => (
            <button
              type="button"
              onClick={() => setActiveTab(tab)}
              className="tab tab-hover-effect"
            >
              <span id="tab-position">{tab.name}</span>
            </button>
          ))}

          {/* <button
            type="button"
            onClick={createNewTab}
            className="create-new-tab"
          >
            +
          </button> */}
        </div>

        <div className="window-manager">
          <span id="minimize" title="Minimize"></span>
          <span id="maximize" title="Maximize"></span>
          <span id="exit" title="Exit (Ctrl + w)"></span>
        </div>
      </div>

      <SubHeader
        tab={activeTab}
        handlePathChange={handlePathChange}
      />
    </div>
  );
};

export default Header;
