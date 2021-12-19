import React from 'react';

export interface IImageViewerProps {
  filePath: string
}

const ImageViewer = ({ filePath }: IImageViewerProps): JSX.Element => {
  return (<div>Image viewer: {filePath}</div>);
}

export default ImageViewer;
