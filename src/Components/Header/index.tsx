import React from "react";
import { useDispatch, useSelector } from "react-redux";

import SubHeader from "./SubHeader";
import { getStandardPath } from "../../Helpers/paths";
import {
    fetchFilesRequest,
    updateHistoryIdxRequest,
} from "../../Store/ActionCreators/DirectoryActionCreators";
import { setActiveTab } from "../../Store/ActionCreators/TabActionCreators";
import { IAppState } from "../../Store/Reducers";

export interface ITab {
    name: string;
    path: string;
}

const Header = () => {
    const dispatch = useDispatch();
    const tabs = useSelector<IAppState, IAppState["tabs"]["tabs"]>(
        (state) => state.tabs.tabs
    );
    const activeTab = useSelector<IAppState, IAppState["tabs"]["activeTab"]>(
        (state) => state.tabs.activeTab
    );
    const directoryHistoryIdx = useSelector<
        IAppState,
        IAppState["directory"]["historyIdx"]
    >((state) => state.directory.historyIdx);

    const createNewTab = () =>
        dispatch(setActiveTab({ name: "Home", path: activeTab.path }));

    const handleBack = () =>
        dispatch(updateHistoryIdxRequest(directoryHistoryIdx - 1));
    const handleForward = () =>
        dispatch(updateHistoryIdxRequest(directoryHistoryIdx + 1));
    const handlePathChange = (tab: ITab) =>
        dispatch(setActiveTab({ ...tab, path: getStandardPath(tab.path) }));
    const refreshDirectory = (dirName: string) =>
        dispatch(fetchFilesRequest(dirName));

    return (
        <div id="header-container" className="topbar" data-tauri-drag-region>
            <div>
                <div>
                    {Object.values(tabs).reduce<JSX.Element[]>(
                        (accum, tab) => [
                            ...accum,
                            <button
                                type="button"
                                onClick={() => dispatch(setActiveTab(tab))}
                                className="tab tab-hover-effect"
                                key={tab.name}
                            >
                                <span id="tab-position">{`${
                                    activeTab?.name === tab.name
                                        ? "[active] "
                                        : ""
                                }${tab.name}`}</span>
                            </button>,
                        ],
                        []
                    )}

                    <button type="button" onClick={createNewTab}>
                        +
                    </button>
                </div>

                <div className="window-manager">
                    <span id="minimize" title="Minimize"></span>
                    <span id="maximize" title="Maximize"></span>
                    <span id="exit" title="Exit (Ctrl + w)"></span>
                </div>
            </div>

            <SubHeader
                activeTab={activeTab}
                handleBack={handleBack}
                handleForward={handleForward}
                handlePathChange={handlePathChange}
                handleDirectoryRefresh={refreshDirectory}
            />
        </div>
    );
};

export default Header;
