import { transport } from '../transport';
import type { OrganizationAnalysis, OrganizationPlan } from '../types';

export const analyzeDirectory = async (path: string): Promise<OrganizationAnalysis> => {
  return await transport('analyze_directory', { path });
};

export const previewOrganization = async (
  path: string,
  suggestionIndices: number[],
): Promise<OrganizationPlan> => {
  return await transport('preview_organization', { path, suggestionIndices });
};

export const executeOrganization = async (plan: OrganizationPlan): Promise<number> => {
  return await transport('execute_organization', { plan });
};
