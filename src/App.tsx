import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import MainView from "./Components/MainView";
import SettingsView from "./Components/SettingsView";

import ContextMenu from "./Components/ContextMenu";
import Header from "./Components/Header";
import LoadingBar from "./Components/LoadingBar";
import Properties from "./Components/Properties";
import Sidebar from "./Components/Sidebar";

import { setActiveTab } from "./Store/ActionCreators/TabActionCreators";
import { IAppState } from "./Store/Reducers";
import "./Public/style.scss";

const App = () => {
    const dispatch = useDispatch();

    const homeDirectory = useSelector<
        IAppState,
        IAppState["favorites"]["Home"]
    >((state) => state.favorites.Home);
    const activeTab = useSelector<IAppState, IAppState["tabs"]["activeTab"]>(
        (state) => state.tabs.activeTab
    );
    const config = useSelector<IAppState, IAppState["config"]>(
        (state) => state.config
    );

    const [isLoaded, setIsLoaded] = useState(false); // TODO REPLACE WITH SKELETON LOADING

    const setCurrentDirectory = (path: string) =>
        dispatch(setActiveTab({ ...activeTab, path }));

    // Waits for homeDirectory to load on initial favorites request
    useEffect(() => {
        if (homeDirectory) {
            setIsLoaded(true);
            setCurrentDirectory(homeDirectory);
        }
    }, [homeDirectory]);

    if (!isLoaded) return <div>Loading...</div>;

    const opacityToHex = (opacity: number) => {
        if (opacity < 0 || 1 < opacity) return "FF";
        const scaledOpacity = Math.round(opacity * 255); // Scales to 0-255
        return scaledOpacity.toString(16);
    };

    return (
        <div
            id="app-container"
            style={{
                backgroundColor: `${
                    config?.background ?? "#000000"
                }${opacityToHex(config?.opacity ?? 1)}`,
            }}
        >
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
};

export default App;
