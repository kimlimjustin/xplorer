import React, { useState, FormEvent } from 'react';
import SubHeader from './SubHeader';

export interface ITab {
  name: string,
  path: string
}

const Header = () => {
  const [tabs, setTabs] = useState<ITab[]>([{ name: "Home", path: "xplorer://Home" }]);
  const [activeTab, setActiveTab] = useState<ITab>(tabs[0]);

  const createNewTab = () => {
    console.log('new tab created');
    const newTab = { name: "Home", path: "/" };
    setTabs([...tabs, newTab]);
    setActiveTab(newTab);
  }

  const handlePathChange = (tab: ITab) => (e: FormEvent) => {
    e.preventDefault();
    console.log(`changing active file path to "${tab.path}"`);
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

          <button
            type="button"
            onClick={createNewTab}
            className="create-new-tab"
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
        setPath={(path: string) => setActiveTab({ ...activeTab, path })}
        handlePathChange={handlePathChange}
      />
    </div>
  );
};

export default Header;
