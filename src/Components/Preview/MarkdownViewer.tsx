import React from 'react';

export interface IMarkdownViewerProps {
  filePath: string
}

const MarkdownViewer = ({ filePath }: IMarkdownViewerProps): JSX.Element => {
  return (<div>Markdown viewer: {filePath}</div>);
}

export default MarkdownViewer;
