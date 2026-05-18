
interface CacheItem<T> {
  data: T;
  expiresAt: string;
}

export const setCacheItem = <T,>(key: string, data: T, ttlInHours: number = 24): void => {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + ttlInHours);
  
  const cacheItem: CacheItem<T> = {
    data,
    expiresAt: expiresAt.toISOString()
  };
  
  localStorage.setItem(key, JSON.stringify(cacheItem));
};

export const getCacheItem = <T,>(key: string): T | null => {
  const cached = localStorage.getItem(key);
  if (!cached) return null;
  
  try {
    const item: CacheItem<T> = JSON.parse(cached);
    if (new Date(item.expiresAt) > new Date()) {
      return item.data;
    }
    // Expired
    localStorage.removeItem(key);
    return null;
  } catch (e) {
    console.error('Error parsing cache item', e);
    return null;
  }
};

export const isCacheValid = (key: string): boolean => {
  const cached = localStorage.getItem(key);
  if (!cached) return false;
  
  try {
    const item: CacheItem<unknown> = JSON.parse(cached);
    return new Date(item.expiresAt) > new Date();
  } catch (e) {
    return false;
  }
};

export const removeCacheItem = (key: string): void => {
  localStorage.removeItem(key);
};
