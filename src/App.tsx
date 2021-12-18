import React, { useState } from 'react';

import MainView from './Components/MainView';
import SettingsView from './Components/SettingsView';

import ContextMenu from './Components/ContextMenu';
import Header from './Components/Header';
import LoadingBar from './Components/LoadingBar';
import Properties from './Components/Properties';
import Sidebar from './Components/Sidebar';

const App = () => {
  const [currentDirectory, setCurrentDirectory] = useState('/home/ajmcquilkin/');

  return (
    <div id="app-container">
      <div className="container">
        <Sidebar />
        <main className="main">
          <Header currentDirectory={currentDirectory} setCurrentDirectory={setCurrentDirectory} />
          <LoadingBar isLoading={false} />
          <MainView currentDirectory={currentDirectory} />
        </main>
      </div>
      <SettingsView />
      <ContextMenu />
      <Properties />
    </div>
  );
}

export default App;
