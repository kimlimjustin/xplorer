import React from 'react';

export interface IVideoViewerProps {
  filePath: string
}

const VideoViewer = ({ filePath }: IVideoViewerProps): JSX.Element => {
  return (<div>Video viewer: {filePath}</div>);
}

export default VideoViewer;
