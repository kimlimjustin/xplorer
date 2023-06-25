import omit from "lodash.omit";

import { ITab, ITabReducerState } from "../../Typings/Store/tab";
import { Actions } from "../../Typings/Store/store";

const defaultTab: ITab = {
    name: "Default Tab",
    path: "",
};

interface INewTabs {
    [name: string]: ITab;
}

const initialState: ITabReducerState = {
    tabs: { [defaultTab.name]: defaultTab },
    activeTab: defaultTab,
};

const reducer = (state = initialState, action: Actions): ITabReducerState => {
    if (action.status !== "SUCCESS") return state;

    switch (action.type) {
        case "CREATE_TAB":
            return {
                ...state,
                tabs: {
                    ...state.tabs,
                    [action.tab.name]: action.tab,
                },
            };
        case "UPDATE_TAB":
            const newTabs: INewTabs = {};
            Object.entries(state.tabs).forEach(([name, tab]) => {
                if (name === action.name) {
                    newTabs[action.tab.name] = {
                        ...tab,
                        ...action.tab,
                        name: action.tab.name || tab.name,
                    };
                } else {
                    newTabs[name] = tab;
                }
            });
            return {
                ...state,
                tabs: newTabs,
            };
        case "DELETE_TAB":
            return {
                ...state,
                tabs: omit(state.tabs, action.name),
            };
        case "SET_ACTIVE_TAB":
            return {
                ...state,
                activeTab: action.tab,
            };
        default:
            return state;
    }
};

export default reducer;
