import React from 'react';

const App = () => (
  <div id="app-container">
    <div className="container">
      <div className="sidebar">
        <span className="xplorer-brand">Xplorer</span>
        <div id="sidebar-nav"></div>
        <div className="sidebar-setting-btn sidebar-hover-effect"></div>
      </div>
      <div className="main">
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
        <div className="loading-bar" data-loading="false">
          <span className="loader"></span>
        </div>
        <div className="main-box">
          <div id="workspace" data-path="xplorer://Home"></div>
        </div>
      </div>
    </div>
    <div className="settings">
      <div className="settings-sidebar">
        <div className="settings-sidebar-header exit-setting-btn sidebar-hover-effect">
          <span className="exit-setting-icon">←</span>
          <span className="settings-sidebar-heading">Settings</span>
        </div>
        <div className="settings-sidebar-items"></div>
      </div>
      <div className="settings-main"></div>
    </div>
    <div className="contextmenu"></div>
    <div id="contextmenu-submenus"></div>
    <div className="properties">
      <div className="properties-heading">
        <span className="properties-heading-title"> Properties </span>
        <span className="properties-heading-exit">&times;</span>
      </div>
      <div className="properties-body"></div>
    </div>
  </div>
);

export default App;
