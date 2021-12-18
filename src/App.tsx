import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import MainView from './Components/MainView';
import SettingsView from './Components/SettingsView';

import ContextMenu from './Components/ContextMenu';
import Header from './Components/Header';
import LoadingBar from './Components/LoadingBar';
import Properties from './Components/Properties';
import Sidebar from './Components/Sidebar';

import { fetchFilesRequest } from './Store/ActionCreators/DirectoryActionCreators';
import { IAppState } from './Store/Reducers';

const App = () => {
  const dispatch = useDispatch();
  const homeDirectory = useSelector<IAppState, IAppState['favorites']['HOMEDIR_PATH']>(state => state.favorites.HOMEDIR_PATH); // TODO AVOID RACE CONDITION HERE

  const [isLoaded, setIsLoaded] = useState(false);
  const [currentDirectory, setCurrentDirectory] = useState(homeDirectory);

  useEffect(() => {
    if (homeDirectory) {
      setIsLoaded(true);
      setCurrentDirectory(homeDirectory);
    }
  }, [homeDirectory]);

  useEffect(() => {
    dispatch(fetchFilesRequest(homeDirectory));
  }, []);

  if (!isLoaded) return (<div>Loading...</div>);

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
