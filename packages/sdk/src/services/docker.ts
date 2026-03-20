import { transport } from '../transport';

export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  status: string;
  ports: string;
  created: string;
}

export interface ImageInfo {
  id: string;
  repository: string;
  tag: string;
  size: string;
  created: string;
}

export const dockerIsAvailable = async (): Promise<boolean> => {
  return await transport('docker_is_available');
};

export const dockerListContainers = async (all: boolean): Promise<ContainerInfo[]> => {
  return await transport('docker_list_containers', { all });
};

export const dockerListImages = async (): Promise<ImageInfo[]> => {
  return await transport('docker_list_images');
};

export const dockerStartContainer = async (id: string): Promise<void> => {
  return await transport('docker_start_container', { id });
};

export const dockerStopContainer = async (id: string): Promise<void> => {
  return await transport('docker_stop_container', { id });
};

export const dockerRemoveContainer = async (id: string, force: boolean): Promise<void> => {
  return await transport('docker_remove_container', { id, force });
};

export const dockerRemoveImage = async (id: string, force: boolean): Promise<void> => {
  return await transport('docker_remove_image', { id, force });
};

export const dockerContainerLogs = async (id: string, lines: number): Promise<string> => {
  return await transport('docker_container_logs', { id, lines });
};
