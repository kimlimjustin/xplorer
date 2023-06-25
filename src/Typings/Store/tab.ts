import { AppActionBase } from "./actions";

export interface ITab {
    name: string;
    path: string;
}

export interface ITabReducerState {
    tabs: Record<ITab["name"], ITab>;
    activeTab: ITab;
}

export const CREATE_TAB = "CREATE_TAB"; // * Internal
export const UPDATE_TAB = "UPDATE_TAB"; // * Internal
export const DELETE_TAB = "DELETE_TAB"; // * Internal
export const SET_ACTIVE_TAB = "SET_ACTIVE_TAB"; // * Internal

export type CreateTabSuccess = AppActionBase<typeof CREATE_TAB, "SUCCESS"> & { tab: ITab };
export type UpdateTabSuccess = AppActionBase<typeof UPDATE_TAB, "SUCCESS"> & { name: string; tab: Partial<ITab> };
export type DeleteTabSuccess = AppActionBase<typeof DELETE_TAB, "SUCCESS"> & { name: string };
export type SetActiveTabSuccess = AppActionBase<typeof SET_ACTIVE_TAB, "SUCCESS"> & { tab: ITab; pushToHistory?: boolean };

export type TabActions = CreateTabSuccess | UpdateTabSuccess | DeleteTabSuccess | SetActiveTabSuccess;
export type TabActionTypes = typeof CREATE_TAB | typeof UPDATE_TAB | typeof DELETE_TAB | typeof SET_ACTIVE_TAB;
