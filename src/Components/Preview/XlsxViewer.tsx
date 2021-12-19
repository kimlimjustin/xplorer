import React from 'react';

export interface IXlsxViewerProps {
  filePath: string
}

const XlsxViewer = ({ filePath }: IXlsxViewerProps): JSX.Element => {
  return (<div>Xlsx viewer: {filePath}</div>);
}

export default XlsxViewer;
