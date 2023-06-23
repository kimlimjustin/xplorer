export const SERVICE_ENDPOINT = 'http://localhost:3030/';
export const READ_DIR_ENDPOINT = SERVICE_ENDPOINT + 'read_dir?path=';
export const GET_FAVORITES_PATH_ENDPOINT = SERVICE_ENDPOINT + 'dir/favorites';
export const CHECK_EXIST_ENDPOINT = SERVICE_ENDPOINT + 'check_exist?path=';
export const CHECK_ISDIR_ENDPOINT = SERVICE_ENDPOINT + 'check_isdir?path=';
export const OPEN_FILE_ENDPOINT = SERVICE_ENDPOINT + 'open_file?path=';
export const GET_AVAILABLE_FONTS_ENDPOINT = SERVICE_ENDPOINT + 'get_available_fonts';
export const GET_DIR_SIZE_ENDPOINT = SERVICE_ENDPOINT + 'get_dir_size?path=';
export const GET_DRIVES_ENDPOINT = SERVICE_ENDPOINT + 'drives';
export const GET_PLATFORM_ENDPOINT = SERVICE_ENDPOINT + 'platform';
export const CALCULATE_DIRS_SIZE_ENDPOINT = SERVICE_ENDPOINT + 'calculate_dirs_size?paths=';

export const MAIN_BOX_ELEMENT = () => document.querySelector<HTMLElement>('.main-box');
export const GET_WORKSPACE_ELEMENT = (id: number) => document.getElementById(`workspace-${id}`);

export const GET_TAB_ELEMENT = () => document.querySelector<HTMLElement>('.workspace-tab-active');
