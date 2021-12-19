import React from 'react';
import { useDispatch, useSelector } from 'react-redux';

// import xlsx from 'xlsx';
// import hljs from 'highlight.js';
// import { marked } from 'marked';

import PdfViewer from './PdfViewer';
import HtmlViewer from './HtmlViewer';
import DocxViewer from './DocxViewer';
import XlsxViewer from './XlsxViewer';
import ImageViewer from './ImageViewer';
import VideoViewer from './VideoViewer';
import PlaintextViewer from './PlaintextViewer';
import MarkdownViewer from './MarkdownViewer';

// import { readFileRequest, readAssetRequest, readBufferRequest } from '../../Store/ActionCreators/FilesActionCreators';
import { IAppState } from '../../Store/Reducers';
import { IFile } from '../../Typings/Store/files';

import {
  IMAGE_TYPES, VIDEO_TYPES, PLAINTEXT_TYPES, HTML_TYPES,
  MARKDOWN_TYPES, XLSX_TYPES, DOCX_TYPES, PDF_TYPES,
  extensionMatches
} from '../../Config/file.config';

export interface IPreviewProps {
  filePath: string
}

const Preview = ({ filePath }: IPreviewProps): JSX.Element => {
  // const dispatch = useDispatch();
  const file = useSelector<IAppState, IFile>(state => state.files.files?.[filePath]);

  console.log(filePath.split('.')[filePath.split('.').length - 1]);

  const filePathSplit = filePath.split('.');
  const extension = filePathSplit[filePathSplit.length - 1].toLowerCase();

  if (extensionMatches(PDF_TYPES, extension)) {
    return <PdfViewer filePath={filePath} />;
  } else if (extensionMatches(HTML_TYPES, extension)) {
    return <HtmlViewer filePath={filePath} />;
  } else if (extensionMatches(DOCX_TYPES, extension)) {
    return <DocxViewer filePath={filePath} />;
  } else if (extensionMatches(XLSX_TYPES, extension)) {
    return <XlsxViewer filePath={filePath} />;
  } else if (extensionMatches(IMAGE_TYPES, extension)) {
    return <ImageViewer filePath={filePath} />;
  } else if (extensionMatches(VIDEO_TYPES, extension)) {
    return <VideoViewer filePath={filePath} />;
  } else if (extensionMatches(PLAINTEXT_TYPES, extension)) {
    return <PlaintextViewer filePath={filePath} />;
  } else if (extensionMatches(MARKDOWN_TYPES, extension)) {
    return <MarkdownViewer filePath={filePath} />;
  } else {
    return (<div>{JSON.stringify(file)}</div>);
  }
};

export default Preview;
