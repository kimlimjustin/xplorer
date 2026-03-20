const STORAGE_KEY = 'xplorer:saved-searches';
const MAX_SAVED = 20;

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: {
    fileTypes: string[];
    dateRange: [string, string] | null;
    sizeRange: [number, number] | null;
    extensions: string[];
  };
  created: number;
}

const generateId = () : string => {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export const getSavedSearches = () : SavedSearch[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_SAVED) : [];
  } catch {
    return [];
  }
}

export const saveSearch = (search: Omit<SavedSearch, 'id' | 'created'>) : SavedSearch => {
  const entry: SavedSearch = {
    ...search,
    id: generateId(),
    created: Date.now(),
  };
  const list = getSavedSearches();
  list.unshift(entry);
  if (list.length > MAX_SAVED) list.length = MAX_SAVED;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // localStorage may be full
  }
  window.dispatchEvent(new Event('saved-searches-changed'));
  return entry;
}

export const deleteSavedSearch = (id: string) : void => {
  const list = getSavedSearches().filter((s) => s.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event('saved-searches-changed'));
}

export const renameSavedSearch = (id: string, name: string) : void => {
  const list = getSavedSearches();
  const entry = list.find((s) => s.id === id);
  if (!entry) return;
  entry.name = name;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event('saved-searches-changed'));
}
