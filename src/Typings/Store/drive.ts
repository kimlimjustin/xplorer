import { AppActionBase } from "./actions";

export interface IDrive {
  name: string,
  mount_point: string,
  total_space: number,
  available_space: number,
  is_removable: boolean,
  disk_type: 'HDD' | 'SSD' | 'Removeable Disk',
  file_system: string
}

export interface IUniqueDrive {
  mount_point: string,
  name: string
}

export const FETCH_DRIVES = 'FETCH_DRIVES';
// export const FETCH_UNIQUE_DRIVES = 'FETCH_UNIQUE_DRIVES';

export type FetchDeivesRequest = AppActionBase<typeof FETCH_DRIVES, 'REQUEST'> & {};
export type FetchDeivesSuccess = AppActionBase<typeof FETCH_DRIVES, 'SUCCESS'> & { drives: IDrive[] };
export type FetchDeivesFailure = AppActionBase<typeof FETCH_DRIVES, 'FAILURE'> & { message: string };

// export type FetchUniqueDrivesRequest = AppActionBase<typeof FETCH_UNIQUE_DRIVES, 'REQUEST'> & ;
// export type FetchUniqueDrivesSuccess = AppActionBase<typeof FETCH_UNIQUE_DRIVES, 'SUCCESS'> & {};
// export type FetchUniqueDrivesFailure = AppActionBase<typeof FETCH_UNIQUE_DRIVES, 'FAILURE'>;
