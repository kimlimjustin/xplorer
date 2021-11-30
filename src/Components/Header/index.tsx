import React from 'react';

const Header = () => (
  <div className="topbar" data-tauri-drag-region>
    <div className="row">
      <div className="tabs-manager">
        <div className="tab tab-hover-effect" id="tab1">
          <span id="tab-position">Home</span>
        </div>
        <span className="create-new-tab">+</span>
      </div>
      <div className="window-manager">
        <span id="minimize" title="Minimize"></span>
        <span id="maximize" title="Maximize"></span>
        <span id="exit" title="Exit (Ctrl + w)"></span>
      </div>
    </div>
    <div className="row">
      <div className="navigator">
        <span id="go-back" title="Go Back (Alt + Left Arrow)">&larr;</span>
        <span id="go-forward" title="Go Forward (Alt + Right Arrow)">&rarr;</span>
        <span id="go-parent-dir" title="Parent Directory (Alt + Up Arrow)">&uarr;</span>
        <span id="refresh" title="Reload (f5)">&#10227;</span>
      </div>
      <input className="path-navigator" type="text" value="xplorer://Home" />
    </div>
  </div>
);

export default Header;
