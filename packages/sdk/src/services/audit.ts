import { transport } from '../transport';
import type { AuditLogQuery } from '../types';

export const getAuditLog = async (
  limit?: number,
  offset?: number,
  operationFilter?: string,
  dateFrom?: string,
  dateTo?: string,
): Promise<AuditLogQuery> => {
  return await transport('get_audit_log', { limit, offset, operationFilter, dateFrom, dateTo });
};

export const clearAuditLog = async (): Promise<void> => {
  return await transport('clear_audit_log');
};

export const exportAuditLog = async (outputPath: string): Promise<void> => {
  return await transport('export_audit_log', { outputPath });
};
