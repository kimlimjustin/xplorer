import React, { FormEvent } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import SubHeader from './SubHeader';
import { getStandardPath } from '../../Helpers/paths';
import { fetchFilesRequest } from '../../Store/ActionCreators/DirectoryActionCreators';
import { setActiveTab } from '../../Store/ActionCreators/TabActionCreators';
import { IAppState } from '../..//Store/Reducers';

export interface ITab {
  name: string,
  path: string
}

const Header = () => {
  const dispatch = useDispatch();
  const tabs = useSelector<IAppState, IAppState['tabs']['tabs']>(state => state.tabs.tabs);
  const activeTab = useSelector<IAppState, IAppState['tabs']['activeTab']>(state => state.tabs.activeTab);

  const createNewTab = () => {
    dispatch(setActiveTab({ name: "Home", path: activeTab.path }));
  }

  const updateActiveTab = (tab: ITab) => dispatch(setActiveTab(tab));

  const handlePathChange = (tab: ITab) => (e: FormEvent) => {
    e.preventDefault();
    const path = getStandardPath(tab.path);
    updateActiveTab({ ...tab, path });
    dispatch(fetchFilesRequest(path));
  }

  return (
    <div id="header-container" className="topbar" data-tauri-drag-region>
      <div>
        <div>
          {Object.values(tabs)
            .reduce<JSX.Element[]>(
              (accum, tab) => [
                ...accum, (
                  <button
                    type="button"
                    onClick={() => updateActiveTab(tab)}
                    className="tab tab-hover-effect"
                  >
                    <span id="tab-position">{`${activeTab?.name === tab.name ? '[active] ' : ''}${tab.name}`}</span>
                  </button>
                )
              ], []
            )
          }

          <button
            type="button"
            onClick={createNewTab}
          >
            +
          </button>
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
