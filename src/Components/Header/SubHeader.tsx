import React, { FormEvent, useEffect, useState } from 'react';

import { ITab } from '.';
import { getParentDirectory } from '../../Helpers/paths';

export interface ISubHeaderProps {
  activeTab: ITab,
  handleForward: () => void,
  handleBack: () => void,
  handlePathChange: (tab: ITab) => void,
  handleDirectoryRefresh: (dirName: string) => void
}

const SubHeader = ({
  activeTab, handleBack, handleForward,
  handlePathChange, handleDirectoryRefresh
}: ISubHeaderProps) => {
  const [tempTab, setTempTab] = useState(activeTab);

  // Updates tempTab variable with external tab changes
  useEffect(() => {
    if (JSON.stringify(activeTab) === JSON.stringify(tempTab)) return;
    setTempTab(activeTab);
  }, [activeTab]);

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    handlePathChange(tempTab);
  }

  return (
    <div id="subheader-container" className="row">
      <div className="navigator">
        <button
          type="button"
          onClick={() => handleBack()}
          // id="go-back"
          title="Go Back (Alt + Left Arrow)"
        >
          &larr;
        </button>

        <button
          type="button"
          onClick={() => handleForward()}
          // id="go-forward"
          title="Go Forward (Alt + Right Arrow)"
        >
          &rarr;
        </button>

        <button
          type="button"
          onClick={() => handlePathChange({ ...tempTab, path: getParentDirectory(tempTab.path) })}
          // id="go-parent-dir"
          title="Parent Directory (Alt + Up Arrow)"
        >
          &uarr;
        </button>

        <button
          type="button"
          onClick={() => handleDirectoryRefresh(tempTab.path)}
          // id="refresh"
          title="Reload (f5)"
        >
          &#10227;
        </button>
      </div>

      <form onSubmit={handleFormSubmit}>
        <input
          className="path-navigator"
          type="text"
          value={tempTab.path}
          onChange={(e) => setTempTab({ ...tempTab, path: e.target.value })}
        />
      </form>
    </div>
  );
}

export default SubHeader;
