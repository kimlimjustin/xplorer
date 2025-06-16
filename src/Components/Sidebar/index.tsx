import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setActiveTab, updateTab } from "../../Store/ActionCreators/TabActionCreators";
import { fetchDrivesRequest } from "../../Store/ActionCreators/DriveActionCreators";
import { IAppState } from "../../Store/Reducers";
import { IFavoritesReducerState } from "../../Typings/Store/favorites";
import { IDrive } from "../../Typings/Store/drive";

import XplorerLogo from "../../Icon/extension/xplorer.svg";
import FavoriteLogo from "../../Icon/folder/sidebar-favorite.svg";
import HardDiskLogo from "../../Icon/hard-disk.svg";
import { ThemedDiv, ThemedSpan } from "../Theme";

const Sidebar = () => {
    const dispatch = useDispatch();
    const favorites = useSelector<IAppState, IFavoritesReducerState>((state) => state.favorites);
    const { drives } = useSelector<IAppState, IAppState["drive"]>((state) => state.drive);
    const platform = useSelector<IAppState, IAppState["platform"]["os"]>((state) => state.platform.os);

    const activeTab = useSelector<IAppState, IAppState["tabs"]["activeTab"]>((state) => state.tabs.activeTab);

    // Fetch drives when component mounts
    useEffect(() => {
        dispatch(fetchDrivesRequest());
    }, [dispatch]);

    const favoritesSort = (a: [string, string], b: [string, string]): number => (a[0] > b[0] ? 1 : -1);

    const navigateToPath = (path: string) => {
        dispatch(updateTab(activeTab.name, { ...activeTab, path, name: path }));
        dispatch(setActiveTab({ ...activeTab, path, name: path }));
    };

    // Compute drive display name based on platform and drive properties
    const getDriveDisplayName = (drive: IDrive) => {
        if (platform === "windows") {
            const hasName = drive.name && /[^?]/.test(drive.name);
            const baseName = hasName ? drive.name : drive.disk_type;
            const mountPoint = drive.mount_point.replace(/\\$/g, "");
            return `${baseName} (${mountPoint})`;
        } else {
            return drive.mount_point.split("/").at(-1) || drive.mount_point;
        }
    };

    return (
        <ThemedDiv componentName="sidebar" className="sidebar">
            <ThemedSpan componentName="xplorerBrand" className="xplorer-brand">
                <span>Xplorer</span>
                <img alt="Xplorer Logo" src={XplorerLogo} />
            </ThemedSpan>
            <ThemedDiv componentName="sidebarNav" className="sidebar-nav">
                <ThemedDiv componentName="sidebarNavFavorites" id="sidebar-favorites" data-section="favorites">
                    <ThemedDiv componentName="sidebarNavToogle" className="sidebar-nav-toggle sidebar-hover-effect">
                        <img alt="Favorites" src={FavoriteLogo} />
                        <span className="sidebar-text">Favorites</span>
                        <span className="sidebar-nav-toggle-arrow" />
                    </ThemedDiv>
                    <ThemedDiv componentName="sidebarNavFavoritesList" className="sidebar-nav-list">
                        {Object.entries(favorites)
                            .sort(favoritesSort)
                            .map(([name, path]) => (
                                <ThemedSpan
                                    componentName="sidebarNavFavoritesItem"
                                    data-path={path}
                                    className="sidebar-hover-effect sidebar-nav-item favorite-item"
                                    onClick={() => navigateToPath(path)}
                                    key={path + name}
                                >
                                    <div className="sidebar-icon"></div>
                                    <ThemedSpan componentName="sidebarText" className="sidebar-text">
                                        {name}
                                    </ThemedSpan>
                                </ThemedSpan>
                            ))}
                    </ThemedDiv>
                </ThemedDiv>
                <div id="sidebar-drives" data-section="drives">
                    <ThemedDiv componentName="sidebarNavToogle" className="sidebar-nav-toggle sidebar-hover-effect">
                        <img src={HardDiskLogo} alt="Drives" />
                        <span className="sidebar-text">{platform === "linux" ? "Pendrives" : "Drives"}</span>
                        <span className="sidebar-nav-toggle-arrow" />
                    </ThemedDiv>
                    <div className="sidebar-nav-list">
                        {drives.map((drive) => (
                            <span
                                data-path={drive.mount_point}
                                className="sidebar-hover-effect sidebar-nav-item drive-item"
                                onClick={() => navigateToPath(drive.mount_point.replace(/\\/g, "/"))}
                                key={drive.mount_point}
                            >
                                <div className="sidebar-icon"></div>
                                <ThemedSpan componentName="sidebarText" className="sidebar-text">
                                    {getDriveDisplayName(drive)}
                                </ThemedSpan>
                            </span>
                        ))}
                    </div>
                </div>
            </ThemedDiv>
            <a>Settings</a>
        </ThemedDiv>
    );
};

export default Sidebar;
