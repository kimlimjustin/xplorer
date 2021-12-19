import React from 'react';

export interface IDocxViewerProps {
  filePath: string
}

const DocxViewer = ({ filePath }: IDocxViewerProps): JSX.Element => {
  return (<div>Docx viewer: {filePath}</div>);
}

export default DocxViewer;
