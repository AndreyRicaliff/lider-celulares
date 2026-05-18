import { setCacheItem, getCacheItem } from '@/lib/cache';

// Utilitário para gerenciar cache de API
export const apiCache = {
  get: <T>(key: string) => getCacheItem<T>(`api_${key}`),
  set: <T>(key: string, data: T, ttlHours: number = 1) => setCacheItem(`api_${key}`, data, ttlHours),
};
