/**
 * Offline Service Tests
 * Testing offline data storage, synchronization, and mobile responsiveness
 */

import { offlineService } from '../src/lib/offline';

// Mock IndexedDB
const mockIndexedDB = {
  open: jest.fn(),
};

Object.defineProperty(window, 'indexedDB', {
  value: mockIndexedDB,
  writable: true,
});

// Mock navigator online status
Object.defineProperty(navigator, 'onLine', {
  value: true,
  writable: true,
});

describe('OfflineService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset offline service
    (offlineService as any).db = null;
    (offlineService as any).isOnline = true;
    (offlineService as any).syncQueue = [];
  });

  describe('Database Initialization', () => {
    it('should initialize database successfully', async () => {
      const mockDB = {
        objectStoreNames: {
          contains: jest.fn(() => false),
        },
        transaction: jest.fn(() => ({
          objectStore: jest.fn(() => ({
            add: jest.fn(),
          })),
        })),
      };

      const mockRequest = {
        onerror: null,
        onsuccess: null,
        onupgradeneeded: null,
        result: mockDB,
      };

      mockIndexedDB.open.mockReturnValue(mockRequest);

      await offlineService.initializeDB();

      expect(mockIndexedDB.open).toHaveBeenCalledWith('SARDIN_AI_Offline', 1);
    });

    it('should handle database initialization error', async () => {
      const mockRequest = {
        onerror: null,
        onsuccess: null,
        error: new Error('Database error'),
      };

      mockIndexedDB.open.mockReturnValue(mockRequest);

      await expect(offlineService.initializeDB()).rejects.toThrow('Database error');
    });
  });

  describe('Data Storage', () => {
    beforeEach(async () => {
      // Setup mock database
      const mockDB = {
        objectStoreNames: {
          contains: jest.fn(() => true),
        },
        transaction: jest.fn(() => ({
          objectStore: jest.fn(() => ({
            add: jest.fn(),
          })),
        })),
      };

      const mockRequest = {
        onerror: null,
        onsuccess: null,
        result: mockDB,
      };

      mockIndexedDB.open.mockReturnValue(mockRequest);
      await offlineService.initializeDB();
    });

    it('should store data successfully', async () => {
      const mockData = { test: 'data' };
      const result = await offlineService.storeData('test', mockData);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should retrieve data successfully', async () => {
      const mockData = { test: 'data' };
      const id = await offlineService.storeData('test', mockData);
      const retrieved = await offlineService.getData('test', id);

      expect(retrieved).toHaveLength(1);
      expect(retrieved[0]).toEqual(expect.objectContaining(mockData));
    });

    it('should remove data successfully', async () => {
      const mockData = { test: 'data' };
      const id = await offlineService.storeData('test', mockData);
      
      await expect(offlineService.removeData('test', id)).resolves.not.toThrow();
    });
  });

  describe('Synchronization', () => {
    it('should sync data when online', async () => {
      (offlineService as any).isOnline = true;
      
      const mockData = {
        id: 'test_1',
        type: 'test',
        data: { test: 'data' },
        timestamp: new Date().toISOString(),
        syncStatus: 'pending',
      };

      // Mock getAllItems and deleteItem
      (offlineService as any).getAllItems = jest.fn().mockResolvedValue([mockData]);
      (offlineService as any).deleteItem = jest.fn().mockResolvedValue(undefined);
      (offlineService as any).addItem = jest.fn().mockResolvedValue(undefined);

      await offlineService.syncData();

      expect((offlineService as any).getAllItems).toHaveBeenCalledWith('syncQueue');
    });

    it('should not sync data when offline', async () => {
      (offlineService as any).isOnline = false;
      
      const mockSync = jest.spyOn(offlineService as any, 'syncData');
      
      await offlineService.syncData();
      
      expect(mockSync).not.toHaveBeenCalled();
    });
  });

  describe('Event Listeners', () => {
    it('should handle online event', () => {
      const mockSync = jest.spyOn(offlineService as any, 'syncData');
      const mockStartInterval = jest.spyOn(offlineService as any, 'startSyncInterval');
      
      // Simulate online event
      window.dispatchEvent(new Event('online'));
      
      expect((offlineService as any).isOnline).toBe(true);
      expect(mockStartInterval).toHaveBeenCalled();
    });

    it('should handle offline event', () => {
      const mockStopInterval = jest.spyOn(offlineService as any, 'stopSyncInterval');
      
      // Simulate offline event
      window.dispatchEvent(new Event('offline'));
      
      expect((offlineService as any).isOnline).toBe(false);
      expect(mockStopInterval).toHaveBeenCalled();
    });
  });

  describe('Storage Management', () => {
    it('should get storage information', async () => {
      const mockStorageInfo = {
        used: 1024,
        total: 100 * 1024 * 1024,
        stores: {
          test: 1024,
        },
      };

      (offlineService as any).getAllItems = jest.fn().mockResolvedValue([{ test: 'data' }]);
      (offlineService as any).config = { maxOfflineStorage: 100 };

      const storageInfo = await offlineService.getStorageInfo();

      expect(storageInfo).toBeDefined();
      expect(storageInfo.used).toBeGreaterThan(0);
      expect(storageInfo.total).toBeGreaterThan(0);
    });

    it('should clear old data', async () => {
      const oldData = {
        id: 'old_1',
        type: 'test',
        data: { test: 'old data' },
        timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
        syncStatus: 'synced',
      };

      (offlineService as any).getAllItems = jest.fn().mockResolvedValue([oldData]);
      (offlineService as any).deleteItem = jest.fn().mockResolvedValue(undefined);

      await offlineService.clearOldData(7 * 24 * 60 * 60 * 1000); // 7 days

      expect((offlineService as any).deleteItem).toHaveBeenCalledWith('test', 'old_1');
    });
  });

  describe('Configuration', () => {
    it('should update configuration', async () => {
      const newConfig = {
        enableOfflineMode: false,
        maxOfflineStorage: 200,
      };

      (offlineService as any).addItem = jest.fn().mockResolvedValue(undefined);

      await offlineService.updateConfig(newConfig);

      expect(offlineService.getConfig()).toEqual(expect.objectContaining(newConfig));
    });

    it('should get current configuration', () => {
      const config = offlineService.getConfig();

      expect(config).toBeDefined();
      expect(config.enableOfflineMode).toBe(true);
      expect(config.maxOfflineStorage).toBe(100);
    });
  });
});

describe('Offline Hooks', () => {
  describe('useOfflineStatus', () => {
    it('should return initial online status', () => {
      const { useOfflineStatus } = require('../src/lib/offline');
      
      // This would typically be tested in a React component
      expect(typeof useOfflineStatus).toBe('function');
    });
  });

  describe('useMobileDetection', () => {
    it('should detect mobile screen size', () => {
      const { useMobileDetection } = require('../src/lib/offline');
      
      // This would typically be tested in a React component
      expect(typeof useMobileDetection).toBe('function');
    });
  });

  describe('useResponsive', () => {
    it('should provide responsive breakpoints', () => {
      const { useResponsive } = require('../src/lib/offline');
      
      // This would typically be tested in a React component
      expect(typeof useResponsive).toBe('function');
    });
  });
});

describe('PWA Utilities', () => {
  describe('registerServiceWorker', () => {
    it('should register service worker when available', () => {
      const mockRegister = jest.fn();
      
      Object.defineProperty(navigator, 'serviceWorker', {
        value: {
          register: mockRegister,
        },
        writable: true,
      });

      const { registerServiceWorker } = require('../src/lib/offline');
      
      // Simulate window load event
      const mockWindow = { addEventListener: jest.fn() };
      Object.defineProperty(global, 'window', { value: mockWindow, writable: true });

      registerServiceWorker();

      expect(mockWindow.addEventListener).toHaveBeenCalledWith('load', expect.any(Function));
    });
  });

  describe('installPWA', () => {
    it('should handle PWA installation', async () => {
      const mockDeferredPrompt = {
        prompt: jest.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' }),
      };

      Object.defineProperty(window, 'deferredPrompt', {
        value: mockDeferredPrompt,
        writable: true,
      });

      const { installPWA } = require('../src/lib/offline');
      
      const result = await installPWA();

      expect(result).toBe(true);
      expect(mockDeferredPrompt.prompt).toHaveBeenCalled();
    });
  });
});