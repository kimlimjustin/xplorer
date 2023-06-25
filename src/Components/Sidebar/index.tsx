import React from "react";
import { useDispatch, useSelector } from "react-redux";

import { setActiveTab, updateTab } from "../../Store/ActionCreators/TabActionCreators";
import { IAppState } from "../../Store/Reducers";
import { IFavoritesReducerState } from "../../Typings/Store/favorites";

import XplorerLogo from "../../Icon/extension/xplorer.svg";
import FavoriteLogo from "../../Icon/folder/sidebar-favorite.svg";
import HardDiskLogo from "../../Icon/hard-disk.svg";

const Sidebar = () => {
    const dispatch = useDispatch();
    const favorites = useSelector<IAppState, IFavoritesReducerState>((state) => state.favorites);
    const { drives } = useSelector<IAppState, IAppState["drive"]>((state) => state.drive);

    const activeTab = useSelector<IAppState, IAppState["tabs"]["activeTab"]>((state) => state.tabs.activeTab);

    const favoritesSort = (a: [string, string], b: [string, string]): number => (a[0] > b[0] ? 1 : -1);

    const navigateToPath = (path: string) => {
        dispatch(updateTab(activeTab.name, { ...activeTab, path, name: path }));
        dispatch(setActiveTab({ ...activeTab, path, name: path }));
    };

    return (
        <div className="sidebar">
            <span className="xplorer-brand">
                <span>Xplorer</span>
                <img alt="Xplorer Logo" src={XplorerLogo} />
            </span>
            <div className="sidebar-nav">
                <div id="sidebar-favorites" data-section="favorites">
                    <div className="sidebar-nav-toggle sidebar-hover-effect">
                        <img alt="Favorites" src={FavoriteLogo} />
                        <span className="sidebar-text" />
                        <span className="sidebar-nav-toggle-arrow" />
                    </div>
                    <div className="sidebar-nav-list">
                        {Object.entries(favorites)
                            .sort(favoritesSort)
                            .map(([name, path]) => (
                                <span
                                    data-path={path}
                                    className="sidebar-hover-effect sidebar-nav-item favorite-item"
                                    onClick={() => navigateToPath(path)}
                                    key={path + name}
                                >
                                    <div className="sidebar-icon"></div>
                                    <span className="sidebar-text">{name}</span>
                                </span>
                            ))}
                    </div>
                </div>
                <div id="sidebar-drives" data-section="drives">
                    <div className="sidebar-nav-toggle sidebar-hover-effect">
                        <img src={HardDiskLogo} alt="Drives" />
                        <span className="sidebar-text" />
                        <span className="sidebar-nav-toggle-arrow" />
                    </div>
                    <div className="sidebar-nav-list">
                        {drives.map(({ name, mount_point }) => (
                            <span
                                data-path={mount_point}
                                className="sidebar-hover-effect sidebar-nav-item drive-item"
                                onClick={() => navigateToPath(mount_point)}
                                key={mount_point + name}
                            >
                                <div className="sidebar-icon"></div>
                                <span className="sidebar-text">{name}</span>
                            </span>
                        ))}
                    </div>
                </div>
            </div>
            <a>Settings</a>
        </div>
    );
};

export default Sidebar;
