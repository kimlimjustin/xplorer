import React, { FormEvent } from 'react';
import { ITab } from '.';

export interface ISubHeaderProps {
  tab: ITab,
  setPath: (path: string) => void,
  handlePathChange: (tab: ITab) => (e: FormEvent) => void
}

const SubHeader = ({ tab, setPath, handlePathChange }: ISubHeaderProps) => (
  <div id="subheader-container" className="row">
    <div className="navigator">
      <span id="go-back" title="Go Back (Alt + Left Arrow)">&larr;</span>
      <span id="go-forward" title="Go Forward (Alt + Right Arrow)">&rarr;</span>
      <span id="go-parent-dir" title="Parent Directory (Alt + Up Arrow)">&uarr;</span>
      <span id="refresh" title="Reload (f5)">&#10227;</span>
    </div>

    <form onSubmit={handlePathChange(tab)}>
      <input
        className="path-navigator"
        type="text"
        value={tab.path}
        onChange={(e) => setPath(e.target.value)}
      />
    </form>
  </div>
);

export default SubHeader;
