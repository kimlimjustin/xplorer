import omit from 'lodash.omit';

import { IDirectoryReducerState } from "../../Typings/Store/directory";
import { Actions } from "../../Typings/Store/store";

const initialState: IDirectoryReducerState = {
  directories: {},
  listeners: {},
  searches: {}
};

const reducer = (state = initialState, action: Actions): IDirectoryReducerState => {
  if (action.status !== 'SUCCESS') return state;

  switch (action.type) {
    case 'FETCH_FILES':
      return {
        ...state,
        directories: {
          ...state.directories,
          [action.dirName]: {
            ...state.directories?.[action.dirName] || {},
            numFiles: action.meta.num_files,
            skippedFiles: action.meta.skipped_files,
            dirName: action.dirName,
            files: action.meta.files.reduce(
              (accum, curr) => new Set<string>(accum).add(curr.basename),
              new Set<string>()
            )
          }
        }
      };
    case 'FETCH_IS_DIR': // ! CONSIDER NOT IMPLEMENTING IN REDUX (CACHE, DUPLICATE)
      return {
        ...state,
      };
    case 'FETCH_FILE_EXISTS': // ! CONSIDER NOT IMPLEMENTING IN REDUX (CACHE, DUPLICATE)
      return {
        ...state,
      };
    // * Don't need to handle
    // case 'MAKE_DIRECTORY':
    //   return {
    //     ...state,
    //   };
    case 'LISTEN_DIRECTORY':
      return {
        ...state,
        listeners: {
          ...state.listeners,
          [action.dirName]: action.listener
        }
      };
    case 'UNLISTEN_DIRECTORY':
      return {
        ...state,
        listeners: omit(state.listeners, action.dirName)
      };
    case 'FETCH_DIRECTORY_SIZE':
      return {
        ...state,
        directories: {
          ...state.directories,
          [action.dirName]: {
            ...state.directories?.[action.dirName] || {},
            size: action.dirSize
          }
        }
      };
    // ! TODO INCOMPLETE
    // case 'INIT_DIRECTORY_SEARCH':
    //   return {
    //     ...state,
    //   };
    // ! TODO INCOMPLETE
    // case 'CANCEL_DIRECTORY_SEARCH':
    //   return {
    //     ...state,
    //   };
    default:
      return state;
  }
};

export default reducer;

