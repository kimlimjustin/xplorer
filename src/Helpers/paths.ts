/**
 * A function that takes a potentially non-standard path and 
 * converts it into a standardized path. This function allows the use of 
 * paths as standard searchable values across the application.
 * @param path path to standardize
 * @returns standardized path
 */
export const getStandardPath = (path: string): string => {
  if (!path) return path;
  if (path[path.length - 1] !== '/') return (path + '/');
  return path;
};
