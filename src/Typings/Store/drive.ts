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
