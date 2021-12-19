import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import MainView from './Components/MainView';
import SettingsView from './Components/SettingsView';

import ContextMenu from './Components/ContextMenu';
import Header from './Components/Header';
import LoadingBar from './Components/LoadingBar';
import Properties from './Components/Properties';
import Sidebar from './Components/Sidebar';

import { setActiveTab } from './Store/ActionCreators/TabActionCreators';
import { IAppState } from './Store/Reducers';

const App = () => {
  const dispatch = useDispatch();
  const homeDirectory = useSelector<IAppState, IAppState['favorites']['HOMEDIR_PATH']>(state => state.favorites.HOMEDIR_PATH);
  const activeTab = useSelector<IAppState, IAppState['tabs']['activeTab']>(state => state.tabs.activeTab);

  const [isLoaded, setIsLoaded] = useState(false); // TODO REPLACE WITH SKELETON LOADING

  const setCurrentDirectory = (path: string) => dispatch(setActiveTab({ ...activeTab, path }));

  // Waits for homeDirectory to load on initial favorites request 
  useEffect(() => {
    if (homeDirectory) {
      setIsLoaded(true);
      setCurrentDirectory(homeDirectory);
    }
  }, [homeDirectory]);

  if (!isLoaded) return (<div>Loading...</div>);

  return (
    <div id="app-container">
      <div className="container">
        <Sidebar />
        <main className="main">
          <Header />
          <LoadingBar isLoading={false} />
          <MainView currentDirectory={activeTab.path} />
        </main>
      </div>
      <SettingsView />
      <ContextMenu />
      <Properties />
    </div>
  );
}

export default App;
