import React from 'react';

export interface ILoadingBarProps {
  isLoading: boolean
}

const LoadingBar = ({ isLoading }: ILoadingBarProps) => (
  <div className="loading-bar" data-loading={isLoading}>
    <span className="loader"></span>
  </div>
);

export default LoadingBar;
