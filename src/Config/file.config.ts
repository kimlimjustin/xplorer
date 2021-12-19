export const IMAGE_TYPES = ['jpg', 'png', 'gif', 'bmp', 'jpeg', 'jpe', 'jif', 'jfif', 'jfi', 'webp', 'tiff', 'tif', 'ico', 'svg', 'webp'];
export const VIDEO_TYPES = ['mp4', 'webm', 'mpg', 'mp2', 'mpeg', 'mpe', 'mpv', 'ocg', 'm4p', 'm4v', 'avi', 'wmv', 'mov', 'qt', 'flv', 'swf'];
export const PLAINTEXT_TYPES = ['txt'];
export const HTML_TYPES = ['html', 'htm', 'xhtml', 'html_vm', 'asp'];
export const MARKDOWN_TYPES = ['md', 'markdown', 'mdown', 'mkd', 'mkdown', 'mdwn', 'mdtxt', 'mdtext', 'text'];
export const XLSX_TYPES = ['xlsx', 'xls', 'xlsb', 'xls', 'ods', 'fods', 'csv'];
export const DOCX_TYPES = ['doc', 'docb', 'docm', 'dot', 'dotm', 'docx', 'rtf'];
export const PDF_TYPES = ['pdf'];

export const extensionMatches = (extList: string[], extension: string): boolean => extList.includes(extension);
