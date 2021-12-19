import React from 'react';

export interface IHtmlViewerProps {
  filePath: string
}

const HtmlViewer = ({ filePath }: IHtmlViewerProps): JSX.Element => {
  return (<div>pdf viewer: {filePath}</div>);
}

export default HtmlViewer;
