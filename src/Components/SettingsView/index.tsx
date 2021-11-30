import React from 'react';

const SettingsView = () => (
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
);

export default SettingsView;
