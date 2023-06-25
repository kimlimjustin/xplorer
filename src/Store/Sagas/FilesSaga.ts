import { all, call, takeLatest } from "redux-saga/effects";

import {
    calculateFileSizeFailure,
    calculateFileSizeSuccess,
    copyFileFailure,
    copyFileSuccess,
    createFileFailure,
    createFileSuccess,
    cutFileFailure,
    cutFileSuccess,
    extractIconFailure,
    extractIconSuccess,
    fetchFilePropertiesFailure,
    fetchFilePropertiesSuccess,
    getTrashedFilesFailure,
    getTrashedFilesSuccess,
    isDirectoryFailure,
    isDirectorySuccess,
    openFileFailure,
    openFileSuccess,
    readAssetFailure,
    readAssetSuccess,
    readFileFailure,
    readFileSuccess,
    readJsonFileFailure,
    readJsonFileSuccess,
    removeFileFailure,
    removeFileSuccess,
    renameFileFailure,
    renameFileSuccess,
    revealFileFailure,
    revealFileSuccess,
    deleteFilesFailure,
    deleteFilesSuccess,
    restoreFileFailure,
    restoreFileSuccess,
    restoreFilesFailure,
    restoreFilesSuccess,
    purgeFilesFailure,
    purgeFilesSuccess,
} from "../ActionCreators/FilesActionCreators";

import {
    TrashData,
    FileTrashMeta,
    CalculateFileSizeRequest,
    CopyFileRequest,
    CreateFileRequest,
    CutFileRequest,
    ExtractIconRequest,
    FetchFilePropertiesRequest,
    IsDirectoryRequest,
    OpenFileRequest,
    ReadAssetRequest,
    ReadFileRequest,
    ReadJsonFileRequest,
    RemoveFileRequest,
    RenameFileRequest,
    RevealFileRequest,
    DeleteFilesRequest,
    RestoreFileRequest,
    RestoreFilesRequest,
    PurgeFilesRequest,
} from "../../Typings/Store/files";

import { selectStatus, typedPut as put } from "./helpers";
import * as FilesService from "../../Services/FilesService";
import FileMetaData from "../../Typings/fileMetaData";

function* readFileWorker(action: ReadFileRequest) {
    try {
        const { fileName } = action;
        const content: string = yield call(FilesService.readFile, fileName);
        yield put(readFileSuccess(fileName, content));
    } catch (error) {
        yield put(readFileFailure(error.message));
    }
}

function* openFileWorker(action: OpenFileRequest) {
    try {
        const { fileName } = action;
        yield call(FilesService.openFile, fileName);
        yield put(openFileSuccess());
    } catch (error) {
        yield put(openFileFailure(error.message));
    }
}

function* readAssetWorker(action: ReadAssetRequest) {
    try {
        const { fileName } = action;
        const content: string = yield call(FilesService.readAsset, fileName);
        yield put(readAssetSuccess(fileName, content));
    } catch (error) {
        yield put(readAssetFailure(error.message));
    }
}

function* readJSONFileWorker(action: ReadJsonFileRequest) {
    try {
        const { fileName } = action;
        const content: JSON = yield call(FilesService.readJSONFile, fileName);
        yield put(readJsonFileSuccess(fileName, content));
    } catch (error) {
        yield put(readJsonFileFailure(error.message));
    }
}

function* createFileWorker(action: CreateFileRequest) {
    try {
        const { fileName } = action;
        yield call(FilesService.createFile, fileName);
        yield put(createFileSuccess());
    } catch (error) {
        yield put(createFileFailure(error.message));
    }
}

function* fetchFilePropertiesWorker(action: FetchFilePropertiesRequest) {
    try {
        const { fileName } = action;
        const metadata: FileMetaData = yield call(FilesService.fetchFileProperties, fileName);
        yield put(fetchFilePropertiesSuccess(fileName, metadata));
    } catch (error) {
        yield put(fetchFilePropertiesFailure(error.message));
    }
}

function* isDirectoryWorker(action: IsDirectoryRequest) {
    try {
        const { fileName } = action;
        const isDirectory: boolean = yield call(FilesService.isDirectory, fileName);
        yield put(isDirectorySuccess(fileName, isDirectory));
    } catch (error) {
        yield put(isDirectoryFailure(error.message));
    }
}

function* extractIconWorker(action: ExtractIconRequest) {
    try {
        const { fileName } = action;
        const iconPath: string = yield call(FilesService.extractIcon, fileName);
        yield put(extractIconSuccess(fileName, iconPath));
    } catch (error) {
        yield put(extractIconFailure(error.message));
    }
}

function* calculateFileSizeWorker(action: CalculateFileSizeRequest) {
    try {
        const { fileName } = action;
        const fileSize: number = yield call(FilesService.calculateFileSize, fileName);
        yield put(calculateFileSizeSuccess(fileName, fileSize));
    } catch (error) {
        yield put(calculateFileSizeFailure(error.message));
    }
}

function* renameFileWorker(action: RenameFileRequest) {
    try {
        const { fileName, dest } = action;
        yield call(FilesService.renameFile, fileName, dest);
        yield put(renameFileSuccess(fileName, dest));
    } catch (error) {
        yield put(renameFileFailure(error.message));
    }
}

function* copyFileWorker(action: CopyFileRequest) {
    try {
        const { fileName, dest } = action;
        yield call(FilesService.copyFile, fileName, dest);
        yield put(copyFileSuccess());
    } catch (error) {
        yield put(copyFileFailure(error.message));
    }
}

function* cutFileWorker(action: CutFileRequest) {
    try {
        const { fileName, dest } = action;
        yield call(FilesService.cutFile, fileName, dest);
        yield put(cutFileSuccess());
    } catch (error) {
        yield put(cutFileFailure(error.message));
    }
}

function* removeFileWorker(action: RemoveFileRequest) {
    try {
        const { fileName } = action;
        yield call(FilesService.removeFile, fileName);
        yield put(removeFileSuccess(fileName));
    } catch (error) {
        yield put(removeFileFailure(error.message));
    }
}

function* revealFileWorker(action: RevealFileRequest) {
    try {
        const { fileName, app } = action;
        yield call(FilesService.revealFile, fileName, app);
        yield put(revealFileSuccess());
    } catch (error) {
        yield put(revealFileFailure(error.message));
    }
}

function* getTrashedFilesWorker(/* action: GetTrashedFilesRequest */) {
    try {
        const metadata: TrashData = yield call(FilesService.getTrashedFiles);
        yield put(getTrashedFilesSuccess(metadata));
    } catch (error) {
        yield put(getTrashedFilesFailure(error.message));
    }
}

function* deleteFilesWorker(action: DeleteFilesRequest) {
    try {
        const { paths } = action;
        yield call(FilesService.deleteFiles, paths);
        yield put(deleteFilesSuccess(paths));
    } catch (error) {
        yield put(deleteFilesFailure(error.message));
    }
}

function* restoreFileWorker(action: RestoreFileRequest) {
    try {
        const { originalParent, basename } = action;
        yield call(FilesService.restoreFile, originalParent, basename);
        yield put(restoreFileSuccess());
    } catch (error) {
        yield put(restoreFileFailure(error.message));
    }
}

function* restoreFilesWorker(action: RestoreFilesRequest) {
    try {
        const { paths, force } = action;
        const metadata: FileTrashMeta = yield call(FilesService.restoreFiles, paths, force);
        yield put(restoreFilesSuccess(metadata));
    } catch (error) {
        yield put(restoreFilesFailure(error.message));
    }
}

function* purgeFilesWorker(action: PurgeFilesRequest) {
    try {
        const { paths } = action;
        yield call(FilesService.purgeFiles, paths);
        yield put(purgeFilesSuccess(paths));
    } catch (error) {
        yield put(purgeFilesFailure(error.message));
    }
}

function* filesSaga() {
    yield all([
        takeLatest(selectStatus("READ_FILE"), readFileWorker),
        takeLatest(selectStatus("OPEN_FILE"), openFileWorker),
        takeLatest(selectStatus("READ_ASSET"), readAssetWorker),
        takeLatest(selectStatus("READ_JSON_FILE"), readJSONFileWorker),
        takeLatest(selectStatus("CREATE_FILE"), createFileWorker),
        takeLatest(selectStatus("FETCH_FILE_PROPERTIES"), fetchFilePropertiesWorker),
        takeLatest(selectStatus("IS_DIRECTORY"), isDirectoryWorker),
        takeLatest(selectStatus("EXTRACT_ICON"), extractIconWorker),
        takeLatest(selectStatus("CALCULATE_FILE_SIZE"), calculateFileSizeWorker),
        takeLatest(selectStatus("RENAME_FILE"), renameFileWorker),
        takeLatest(selectStatus("COPY_FILE"), copyFileWorker),
        takeLatest(selectStatus("CUT_FILE"), cutFileWorker),
        takeLatest(selectStatus("REMOVE_FILE"), removeFileWorker),
        takeLatest(selectStatus("REVEAL_FILE"), revealFileWorker),
        takeLatest(selectStatus("GET_TRASHED_FILES"), getTrashedFilesWorker),
        takeLatest(selectStatus("DELETE_FILES"), deleteFilesWorker),
        takeLatest(selectStatus("RESTORE_FILE"), restoreFileWorker),
        takeLatest(selectStatus("RESTORE_FILES"), restoreFilesWorker),
        takeLatest(selectStatus("PURGE_FILES"), purgeFilesWorker),
    ]);
}

export default filesSaga;
