import React from 'react';
import { useSelector } from 'react-redux';

import { IAppState } from '../../Store/Reducers';
import { IFavoritesReducerState } from '../../Typings/Store/favorites';

const Sidebar = () => {
  const favorites = useSelector<IAppState, IFavoritesReducerState>(state => state.favorites);

  const favoritesSort = (a: [string, string], b: [string, string]): number => (a[0] > b[0] ? 1 : -1);

  const navigateToPath = (path: string) => {
    console.info("Navigating to path:", path);
  }

  return (
    <div className="sidebar-container">
      <span className="xplorer-brand">Xplorer</span>
      <div id="favorites-container">
        {Object.entries(favorites)
          .sort(favoritesSort)
          .map(([name, path]) => (
            <button
              type="button"
              onClick={() => navigateToPath(path)}
            >
              <span>icon</span>
              <p>{`${name} -> ${path}`}</p>
            </button>
          ))
        }
      </div>
      <a>Settings</a>
    </div>
  );
};

export default Sidebar;
