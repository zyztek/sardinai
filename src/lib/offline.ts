/**
 * Offline Capabilities Service for SARDIN-AI
 * Provides offline data storage, synchronization, and mobile-responsive design utilities
 */

import { useState, useEffect, useCallback } from 'react';

export interface OfflineData {
  id: string;
  type: 'oceanographic' | 'prediction' | 'vessel' | 'alert' | 'map';
  data: any;
  timestamp: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  syncStatus: 'pending' | 'synced' | 'failed';
}

export interface OfflineConfig {
  enableOfflineMode: boolean;
  maxOfflineStorage: number; // in MB
  syncInterval: number; // in milliseconds
  autoSync: boolean;
  retryAttempts: number;
}

class OfflineService {
  private db: IDBDatabase | null = null;
  private isOnline: boolean = navigator.onLine;
  private syncQueue: OfflineData[] = [];
  private syncInterval: NodeJS.Timeout | null = null;
  private config: OfflineConfig = {
    enableOfflineMode: true,
    maxOfflineStorage: 100, // 100MB
    syncInterval: 30000, // 30 seconds
    autoSync: true,
    retryAttempts: 3
  };

  constructor() {
    this.initializeDB();
    this.setupEventListeners();
    this.loadConfig();
  }

  private async initializeDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('SARDIN_AI_Offline', 1);

      request.onerror = () => {
        console.error('Failed to initialize offline database');
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('Offline database initialized successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores for different data types
        if (!db.objectStoreNames.contains('oceanographic')) {
          db.createObjectStore('oceanographic', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('predictions')) {
          db.createObjectStore('predictions', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('vessels')) {
          db.createObjectStore('vessels', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('alerts')) {
          db.createObjectStore('alerts', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('maps')) {
          db.createObjectStore('maps', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('syncQueue')) {
          db.createObjectStore('syncQueue', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('config')) {
          db.createObjectStore('config', { keyPath: 'key' });
        }
      };
    });
  }

  private setupEventListeners(): void {
    // Online/offline event listeners
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.handleOnline();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.handleOffline();
    });

    // Visibility change for background sync
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.isOnline) {
        this.syncData();
      }
    });
  }

  private async loadConfig(): Promise<void> {
    try {
      const config = await this.getItem('config', 'offlineConfig');
      if (config) {
        this.config = { ...this.config, ...config };
      }
    } catch (error) {
      console.error('Failed to load offline config:', error);
    }
  }

  private handleOnline(): void {
    console.log('Device is online');
    this.syncData();
    if (this.config.autoSync) {
      this.startSyncInterval();
    }
  }

  private handleOffline(): void {
    console.log('Device is offline');
    this.stopSyncInterval();
  }

  private startSyncInterval(): void {
    if (this.syncInterval) return;
    
    this.syncInterval = setInterval(() => {
      this.syncData();
    }, this.config.syncInterval);
  }

  private stopSyncInterval(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // Data storage methods
  async storeData(type: OfflineData['type'], data: any, id?: string): Promise<string> {
    if (!this.db || !this.config.enableOfflineMode) {
      return '';
    }

    const offlineData: OfflineData = {
      id: id || `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      timestamp: new Date().toISOString(),
      syncStatus: this.isOnline ? 'synced' : 'pending'
    };

    try {
      await this.addItem(type, offlineData);
      
      // If offline, add to sync queue
      if (!this.isOnline) {
        await this.addItem('syncQueue', offlineData);
      }

      return offlineData.id;
    } catch (error) {
      console.error(`Failed to store ${type} data:`, error);
      throw error;
    }
  }

  async getData(type: OfflineData['type'], id?: string): Promise<any[]> {
    if (!this.db || !this.config.enableOfflineMode) {
      return [];
    }

    try {
      if (id) {
        const item = await this.getItem(type, id);
        return item ? [item] : [];
      } else {
        return this.getAllItems(type);
      }
    } catch (error) {
      console.error(`Failed to get ${type} data:`, error);
      return [];
    }
  }

  async removeData(type: OfflineData['type'], id: string): Promise<void> {
    if (!this.db || !this.config.enableOfflineMode) {
      return;
    }

    try {
      await this.deleteItem(type, id);
      // Also remove from sync queue if present
      await this.deleteItem('syncQueue', id);
    } catch (error) {
      console.error(`Failed to remove ${type} data:`, error);
      throw error;
    }
  }

  // Synchronization methods
  async syncData(): Promise<void> {
    if (!this.isOnline || !this.config.enableOfflineMode) {
      return;
    }

    try {
      const syncQueue = await this.getAllItems('syncQueue');
      
      for (const item of syncQueue) {
        await this.syncItem(item);
      }
    } catch (error) {
      console.error('Failed to sync data:', error);
    }
  }

  private async syncItem(item: OfflineData): Promise<void> {
    let attempts = 0;
    
    while (attempts < this.config.retryAttempts) {
      try {
        // Attempt to sync with server
        await this.sendToServer(item);
        
        // Update sync status
        item.syncStatus = 'synced';
        await this.addItem(item.type, item);
        await this.deleteItem('syncQueue', item.id);
        
        console.log(`Successfully synced ${item.type} data: ${item.id}`);
        break;
      } catch (error) {
        attempts++;
        console.error(`Sync attempt ${attempts} failed for ${item.id}:`, error);
        
        if (attempts >= this.config.retryAttempts) {
          item.syncStatus = 'failed';
          await this.addItem(item.type, item);
          console.error(`Failed to sync ${item.id} after ${attempts} attempts`);
        } else {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
        }
      }
    }
  }

  private async sendToServer(item: OfflineData): Promise<void> {
    // This would typically make an API call to sync data with the server
    // For now, we'll simulate it
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Simulate 90% success rate
        if (Math.random() > 0.1) {
          resolve();
        } else {
          reject(new Error('Server sync failed'));
        }
      }, 500);
    });
  }

  // IndexedDB helper methods
  private async addItem(storeName: string, data: any): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.add(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async getItem(storeName: string, key: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async getAllItems(storeName: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async deleteItem(storeName: string, key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Utility methods
  async clearOldData(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    if (!this.db || !this.config.enableOfflineMode) {
      return;
    }

    const cutoffTime = Date.now() - maxAge;
    const stores = ['oceanographic', 'predictions', 'vessels', 'alerts', 'maps'];

    for (const storeName of stores) {
      try {
        const items = await this.getAllItems(storeName);
        const oldItems = items.filter(item => 
          new Date(item.timestamp).getTime() < cutoffTime
        );

        for (const item of oldItems) {
          await this.deleteItem(storeName, item.id);
        }
      } catch (error) {
        console.error(`Failed to clear old data from ${storeName}:`, error);
      }
    }
  }

  async getStorageInfo(): Promise<{ used: number; total: number; stores: Record<string, number> }> {
    if (!this.db || !this.config.enableOfflineMode) {
      return { used: 0, total: this.config.maxOfflineStorage * 1024 * 1024, stores: {} };
    }

    const stores = ['oceanographic', 'predictions', 'vessels', 'alerts', 'maps', 'syncQueue'];
    const storeSizes: Record<string, number> = {};
    let totalUsed = 0;

    for (const storeName of stores) {
      try {
        const items = await this.getAllItems(storeName);
        const size = new Blob([JSON.stringify(items)]).size;
        storeSizes[storeName] = size;
        totalUsed += size;
      } catch (error) {
        console.error(`Failed to get size for ${storeName}:`, error);
        storeSizes[storeName] = 0;
      }
    }

    return {
      used: totalUsed,
      total: this.config.maxOfflineStorage * 1024 * 1024,
      stores: storeSizes
    };
  }

  isOnlineStatus(): boolean {
    return this.isOnline;
  }

  async getSyncStatus(): Promise<{ pending: number; synced: number; failed: number }> {
    if (!this.db || !this.config.enableOfflineMode) {
      return { pending: 0, synced: 0, failed: 0 };
    }

    const syncQueue = await this.getAllItems('syncQueue');
    const allStores = ['oceanographic', 'predictions', 'vessels', 'alerts', 'maps'];
    
    let synced = 0;
    let failed = 0;

    for (const storeName of allStores) {
      try {
        const items = await this.getAllItems(storeName);
        synced += items.filter(item => item.syncStatus === 'synced').length;
        failed += items.filter(item => item.syncStatus === 'failed').length;
      } catch (error) {
        console.error(`Failed to get sync status for ${storeName}:`, error);
      }
    }

    return {
      pending: syncQueue.length,
      synced,
      failed
    };
  }

  async updateConfig(newConfig: Partial<OfflineConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    await this.addItem('config', { key: 'offlineConfig', ...this.config });
  }

  getConfig(): OfflineConfig {
    return { ...this.config };
  }
}

// Global offline service instance
export const offlineService = new OfflineService();

// React hooks for offline functionality
export function useOfflineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export function useOfflineData<T>(
  type: OfflineData['type'],
  id?: string,
  dependencies: any[] = []
): { data: T[]; loading: boolean; error: string | null; refresh: () => Promise<void> } {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await offlineService.getData(type, id);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [type, id]);

  useEffect(() => {
    refresh();
  }, [refresh, ...dependencies]);

  return { data, loading, error, refresh };
}

export function useOfflineStorage() {
  const [storageInfo, setStorageInfo] = useState({
    used: 0,
    total: offlineService.getConfig().maxOfflineStorage * 1024 * 1024,
    stores: {} as Record<string, number>
  });

  const refreshStorageInfo = useCallback(async () => {
    try {
      const info = await offlineService.getStorageInfo();
      setStorageInfo(info);
    } catch (error) {
      console.error('Failed to get storage info:', error);
    }
  }, []);

  useEffect(() => {
    refreshStorageInfo();
  }, [refreshStorageInfo]);

  const clearOldData = useCallback(async (maxAge?: number) => {
    try {
      await offlineService.clearOldData(maxAge);
      await refreshStorageInfo();
    } catch (error) {
      console.error('Failed to clear old data:', error);
    }
  }, [refreshStorageInfo]);

  return {
    storageInfo,
    refreshStorageInfo,
    clearOldData
  };
}

export function useSyncStatus() {
  const [syncStatus, setSyncStatus] = useState({
    pending: 0,
    synced: 0,
    failed: 0
  });

  const refreshSyncStatus = useCallback(async () => {
    try {
      const status = await offlineService.getSyncStatus();
      setSyncStatus(status);
    } catch (error) {
      console.error('Failed to get sync status:', error);
    }
  }, []);

  useEffect(() => {
    refreshSyncStatus();
    
    // Set up interval to refresh sync status
    const interval = setInterval(refreshSyncStatus, 5000);
    
    return () => clearInterval(interval);
  }, [refreshSyncStatus]);

  const syncNow = useCallback(async () => {
    try {
      await offlineService.syncData();
      await refreshSyncStatus();
    } catch (error) {
      console.error('Failed to sync data:', error);
    }
  }, [refreshSyncStatus]);

  return {
    syncStatus,
    refreshSyncStatus,
    syncNow
  };
}

// Mobile-responsive utilities
export function useMobileDetection() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

export function useResponsive() {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  });

  useEffect(() => {
    function handleResize() {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowSize.width < 768;
  const isTablet = windowSize.width >= 768 && windowSize.width < 1024;
  const isDesktop = windowSize.width >= 1024;

  return {
    windowSize,
    isMobile,
    isTablet,
    isDesktop,
  };
}

// Progressive Web App utilities
export function registerServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('SW registered: ', registration);
        })
        .catch((registrationError) => {
          console.log('SW registration failed: ', registrationError);
        });
    });
  }
}

export function requestInstallPrompt() {
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      // Store the event so it can be triggered later
      (window as any).deferredPrompt = e;
    });
  }
}

export async function installPWA(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  
  const deferredPrompt = (window as any).deferredPrompt;
  if (!deferredPrompt) return false;

  try {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    (window as any).deferredPrompt = null;
    return outcome === 'accepted';
  } catch (error) {
    console.error('PWA installation failed:', error);
    return false;
  }
}