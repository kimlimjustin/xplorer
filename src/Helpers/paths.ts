export const dirDelimiter = '/';

/**
 * A function that takes a potentially non-standard path and 
 * converts it into a standardized path. This function allows the use of 
 * paths as standard searchable values across the application.
 * @param path path to standardize
 * @returns standardized path
 */
export const getStandardPath = (path: string): string => {
  if (!path) return dirDelimiter;
  if (path[path.length - 1] !== dirDelimiter) return (path + '/');
  return path;
};

export const getParentDirectory = (text: string): string => {
  if (!text) return text;
  const path = getStandardPath(text);
  const heirarchy = path.split(dirDelimiter).slice(0, -2);
  return getStandardPath(heirarchy.join(dirDelimiter));
}
