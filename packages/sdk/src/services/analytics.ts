import { transport } from '../transport';
import type { StorageAnalytics, DiagnosisResult } from '../types';

export const analyzeStorage = async (path: string): Promise<StorageAnalytics> => {
  return await transport('analyze_storage', { path });
};

export const diagnoseDirectory = async (
  path: string,
  skipHidden: boolean = true,
  skipGitignored: boolean = true,
): Promise<DiagnosisResult> => {
  return await transport('diagnose_directory', { path, skipHidden, skipGitignored });
};
