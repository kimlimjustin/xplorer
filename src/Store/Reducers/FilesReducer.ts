import omit from 'lodash.omit';
import omitBy from 'lodash.omitby';

import { IFilesReducerState } from "../../Typings/Store/files";
import { Actions } from "../../Typings/Store/store";

const initialState: IFilesReducerState = {
  buffers: {},
  files: {},
  skippedFiles: [],
  jsonFiles: {},
  trashedFiles: {},
  filePreview: null
};

const reducer = (state = initialState, action: Actions): IFilesReducerState => {
  if (action.status !== 'SUCCESS') return state;

  switch (action.type) {
    case 'FETCH_FILES':
      return {
        ...state,
        files: action.meta.files.reduce(
          (accum, curr) => ({
            ...accum,
            [curr.file_path]: curr
          }),
          {}
        ),
        skippedFiles: action.meta.skipped_files
      };

    case 'READ_FILE':
    case 'READ_ASSET':
      return {
        ...state,
        files: {
          ...state.files,
          [action.fileName]: {
            ...state.files?.[action.fileName],
            content: action.content
          }
        }
      };
    case 'READ_BUFFER':
      return {
        ...state,
        buffers: {
          ...state.buffers,
          [action.fileName]: action.content
        }
      };
    // * Don't need to handle
    // case 'OPEN_FILE':
    //   return {
    //     ...state
    //   };
    case 'READ_JSON_FILE':
      return {
        ...state,
        jsonFiles: {
          ...state.jsonFiles,
          [action.fileName]: action.content
        }
      };
    // * Don't need to handle
    // case 'CREATE_FILE':
    //   return {
    //     ...state
    //   };
    case 'FETCH_FILE_PROPERTIES':
      return {
        ...state,
        files: {
          ...state.files,
          [action.fileName]: {
            ...state.files?.[action.fileName] || {},
            ...action.metadata
          }
        }
      };
    case 'IS_DIRECTORY':
      return {
        ...state,
        files: {
          ...state.files,
          [action.fileName]: {
            ...state.files?.[action.fileName],
            is_dir: action.isDirectory
          }
        }
      };
    case 'EXTRACT_ICON':
      return {
        ...state,
        files: {
          ...state.files,
          [action.fileName]: {
            ...state.files?.[action.fileName],
            icon: action.iconPath
          }
        }
      };
    case 'CALCULATE_FILE_SIZE':
      return {
        ...state,
        files: {
          ...state.files,
          [action.fileName]: {
            ...state.files?.[action.fileName],
            size: action.size
          }
        }
      };
    case 'RENAME_FILE':
      return {
        ...state,
        files: {
          ...omit(state.files, action.fileName),
          [action.dest]: state.files?.[action.fileName] || {}
        }
      };
    // * Don't need to handle
    // case 'COPY_FILE':
    //   return {
    //     ...state
    //   };
    // * Don't need to handle
    // case 'CUT_FILE':
    //   return {
    //     ...state
    //   };
    case 'REMOVE_FILE':
      return {
        ...state,
        files: omit(state.files, action.fileName)
      };
    // * Don't need to handle
    // case 'REVEAL_FILE':
    //   return {
    //     ...state
    //   };
    // * Don't need to handle
    // case 'GET_TRASHED_FILES':
    //   return {
    //     ...state
    //   };
    case 'DELETE_FILES':
      return {
        ...state,
        files: omitBy(
          state.files,
          (_, fileName) => action.paths.includes(fileName)
        )
      };
    // * Don't need to handle
    // case 'RESTORE_FILE':
    //   return {
    //     ...state
    //   };
    // * Don't need to handle
    // case 'RESTORE_FILES':
    //   return {
    //     ...state
    //   };
    case 'PURGE_FILES':
      return {
        ...state,
        files: omitBy(
          state.files,
          (_, fileName) => action.paths.includes(fileName)
        )
      };
    case 'OPEN_FILE_PREVIEW':
      return {
        ...state,
        filePreview: action.path
      };
    case 'CLOSE_FILE_PREVIEW':
      return {
        ...state,
        filePreview: null
      };
    default:
      return state;
  }
};

export default reducer;
