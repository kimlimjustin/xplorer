import React from 'react';

export interface IPlaintextViewerProps {
  filePath: string
}

const PlaintextViewer = ({ filePath }: IPlaintextViewerProps): JSX.Element => {
  return (<div>Plaintext viewer: {filePath}</div>);
}

export default PlaintextViewer;
