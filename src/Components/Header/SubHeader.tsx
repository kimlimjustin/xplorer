import React, { FormEvent, useEffect, useState } from 'react';
import { ITab } from '.';

export interface ISubHeaderProps {
  tab: ITab,
  handlePathChange: (tab: ITab) => (e: FormEvent) => void
}

const SubHeader = ({ tab, handlePathChange }: ISubHeaderProps) => {
  const [tempTab, setTempTab] = useState(tab);

  useEffect(() => {
    if (JSON.stringify(tab) === JSON.stringify(tempTab)) return;
    setTempTab({ name: tab.name, path: tab.path });
  }, [tab]);

  return (
    <div id="subheader-container" className="row">
      <div className="navigator">
        <span id="go-back" title="Go Back (Alt + Left Arrow)">&larr;</span>
        <span id="go-forward" title="Go Forward (Alt + Right Arrow)">&rarr;</span>
        <span id="go-parent-dir" title="Parent Directory (Alt + Up Arrow)">&uarr;</span>
        <span id="refresh" title="Reload (f5)">&#10227;</span>
      </div>

      <form onSubmit={handlePathChange(tempTab)}>
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
