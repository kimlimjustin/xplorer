import { transport } from '../transport';

export interface ResizeOp {
  width: number;
  height: number;
  maintain_aspect: boolean;
}

export interface ConvertOp {
  format: string;
}

export interface ImageOperations {
  resize: ResizeOp | null;
  convert: ConvertOp | null;
  quality: number | null;
}

export interface ImageInfo {
  width: number;
  height: number;
  format: string;
  file_size: number;
  color_type: string;
}

export interface BatchImageProgress {
  current_file: string;
  processed: number;
  total: number;
  progress_percentage: number;
  status: string;
}

export interface BatchImageResult {
  path: string;
  output_path: string;
  success: boolean;
  error: string | null;
  original_size: number;
  new_size: number;
}

export const resizeImage = async (
  path: string,
  width: number,
  height: number,
  maintainAspect: boolean,
  outputPath: string,
): Promise<string> => {
  return await transport('resize_image', { path, width, height, maintainAspect, outputPath });
};

export const convertImage = async (
  path: string,
  outputFormat: string,
  quality: number,
  outputPath: string,
): Promise<string> => {
  return await transport('convert_image', { path, outputFormat, quality, outputPath });
};

export const getImageInfo = async (path: string): Promise<ImageInfo> => {
  return await transport('get_image_info', { path });
};

export const batchProcessImages = async (
  paths: string[],
  operations: ImageOperations,
  outputDir: string,
): Promise<BatchImageResult[]> => {
  return await transport('batch_process_images', { paths, operations, outputDir });
};

export const rotateImage = async (
  path: string,
  degrees: number,
  outputPath: string,
): Promise<string> => {
  return await transport('rotate_image', { path, degrees, outputPath });
};

export const flipImage = async (
  path: string,
  direction: string,
  outputPath: string,
): Promise<string> => {
  return await transport('flip_image', { path, direction, outputPath });
};

export const cropImage = async (
  path: string,
  x: number,
  y: number,
  width: number,
  height: number,
  outputPath: string,
): Promise<string> => {
  return await transport('crop_image', { path, x, y, width, height, outputPath });
};

export const adjustBrightness = async (
  path: string,
  value: number,
  outputPath: string,
): Promise<string> => {
  return await transport('adjust_brightness', { path, value, outputPath });
};

export const adjustContrast = async (
  path: string,
  value: number,
  outputPath: string,
): Promise<string> => {
  return await transport('adjust_contrast', { path, value, outputPath });
};

export const grayscaleImage = async (
  path: string,
  outputPath: string,
): Promise<string> => {
  return await transport('grayscale_image', { path, outputPath });
};
