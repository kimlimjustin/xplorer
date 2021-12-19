import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { readAssetRequest } from '../../Store/ActionCreators/FilesActionCreators';
import { IAppState } from '../../Store/Reducers';

export interface IPdfViewerProps {
  filePath: string
}

const PdfViewer = ({ filePath }: IPdfViewerProps): JSX.Element => {
  const dispatch = useDispatch();
  const content = useSelector<IAppState, any>(state => state.files.files?.[filePath]?.content);

  useEffect(() => {
    dispatch(readAssetRequest(filePath));
  }, [filePath]);

  if (!content) return <div>Loading...</div>;

  return (
    <div id="pdf-preview-container">
      <object
        data={`${content}#toolbar=0&navpanes=1`}
        type="application/pdf"
        className="preview-object"
      >
        <embed
          src={`${content}#toolbar=0&navpanes=1`}
          type="application/pdf" />
      </object>
    </div >
  );
}

export default PdfViewer;
