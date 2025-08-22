/**
 * Jest Setup File for SARDIN-AI Testing Suite
 * Global test setup and mocking configuration
 */

import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';
import fetchMock from 'jest-fetch-mock';

// Configure testing-library
configure({
  testIdAttribute: 'data-testid',
  asyncUtilTimeout: 5000,
});

// Mock fetch globally
fetchMock.enableMocks();

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // Deprecated
    removeListener: jest.fn(), // Deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock window.scrollTo
Object.defineProperty(window, 'scrollTo', {
  value: jest.fn(),
  writable: true,
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock WebSocket
global.WebSocket = class WebSocket {
  constructor(url) {
    this.url = url;
    setTimeout(() => {
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 0);
  }

  send = jest.fn();
  close = jest.fn();
  onopen = null;
  onmessage = null;
  onerror = null;
  onclose = null;
  readyState = 1;
  CONNECTING = 0;
  OPEN = 1;
  CLOSING = 2;
  CLOSED = 3;
};

// Mock indexedDB
const indexedDB = {
  open: jest.fn(() => ({
    onerror: null,
    onsuccess: null,
    onupgradeneeded: null,
    result: {
      createObjectStore: jest.fn(),
      objectStoreNames: {
        contains: jest.fn(() => false),
      },
      transaction: jest.fn(() => ({
        objectStore: jest.fn(() => ({
          add: jest.fn(),
          get: jest.fn(),
          getAll: jest.fn(),
          delete: jest.fn(),
        })),
      })),
    },
  })),
};

Object.defineProperty(window, 'indexedDB', {
  value: indexedDB,
  writable: true,
});

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
};

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
});

// Mock navigator
Object.defineProperty(navigator, 'onLine', {
  value: true,
  writable: true,
});

Object.defineProperty(navigator, 'serviceWorker', {
  value: {
    register: jest.fn(),
    ready: Promise.resolve({
      showNotification: jest.fn(),
    }),
  },
  writable: true,
});

// Mock performance API
Object.defineProperty(window, 'performance', {
  value: {
    getEntriesByType: jest.fn(),
    getEntriesByName: jest.fn(),
    now: jest.fn(() => Date.now()),
    mark: jest.fn(),
    measure: jest.fn(),
    clearMarks: jest.fn(),
    clearMeasures: jest.fn(),
    getEntries: jest.fn(),
    setResourceTimingBufferSize: jest.fn(),
    toJSON: jest.fn(),
  },
  writable: true,
});

// Mock geolocation
Object.defineProperty(navigator, 'geolocation', {
  value: {
    getCurrentPosition: jest.fn((success) => {
      success({
        coords: {
          latitude: 31.8667,
          longitude: -116.6167,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      });
    }),
    watchPosition: jest.fn(),
    clearWatch: jest.fn(),
  },
  writable: true,
});

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Global test utilities
global.testUtils = {
  // Wait for a specified time
  waitFor: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Create mock component data
  createMockData: {
    oceanographic: () => ({
      sea_surface_temp: 18.5,
      chlorophyll: 0.8,
      salinity: 34.2,
      current_speed: 0.5,
      current_direction: 180,
      wave_height: 1.2,
      wave_period: 10,
      wind_speed: 8,
      wind_direction: 220,
    }),
    
    prediction: () => ({
      sardine_probability: 0.75,
      confidence: 0.85,
      optimal_zones: [
        {
          latitude: 31.8667,
          longitude: -116.6167,
          radius: 10,
          probability: 0.8,
        },
      ],
      migration_pattern: {
        direction: 'north',
        speed: 1.5,
        confidence: 0.7,
      },
    }),
    
    vessel: () => ({
      id: 'vessel_1',
      name: 'Test Vessel',
      type: 'fishing',
      latitude: 31.8667,
      longitude: -116.6167,
      speed: 5,
      heading: 90,
      status: 'active',
    }),
    
    alert: () => ({
      type: 'high_probability',
      severity: 'medium',
      message: 'Test alert message',
      action_required: true,
    }),
  },
  
  // Mock API responses
  mockApiResponse: {
    success: (data) => ({
      ok: true,
      status: 200,
      json: () => Promise.resolve(data),
    }),
    
    error: (message, status = 400) => ({
      ok: false,
      status,
      json: () => Promise.resolve({ error: message }),
    }),
  },
  
  // Mock WebSocket events
  mockWebSocketEvents: {
    open: (ws) => {
      if (ws.onopen) {
        ws.onopen(new Event('open'));
      }
    },
    
    message: (ws, data) => {
      if (ws.onmessage) {
        ws.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
      }
    },
    
    error: (ws, error) => {
      if (ws.onerror) {
        ws.onerror(new ErrorEvent('error', { error }));
      }
    },
    
    close: (ws) => {
      if (ws.onclose) {
        ws.onclose(new CloseEvent('close'));
      }
    },
  },
};

// Setup global error handlers for tests
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection in Test:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception in Test:', error);
});

// Cleanup after each test
afterEach(() => {
  // Clear all mocks
  jest.clearAllMocks();
  
  // Clear fetch mock
  fetchMock.resetMocks();
  
  // Clear localStorage mock
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  localStorageMock.clear.mockClear();
  
  // Clear sessionStorage mock
  sessionStorageMock.getItem.mockClear();
  sessionStorageMock.setItem.mockClear();
  sessionStorageMock.removeItem.mockClear();
  sessionStorageMock.clear.mockClear();
});

// Global test setup
beforeEach(() => {
  // Reset fetch mock
  fetchMock.resetMocks();
  
  // Setup default successful fetch mock
  fetchMock.mockResponse(JSON.stringify({ success: true }));
});

console.log('Jest setup completed for SARDIN-AI testing suite');