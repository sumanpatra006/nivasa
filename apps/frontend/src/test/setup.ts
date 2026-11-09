import '@testing-library/jest-dom';

// Polyfill localStorage in test environment
const storage: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => (key in storage ? storage[key] : null),
  setItem: (key: string, value: string) => {
    storage[key] = String(value);
  },
  removeItem: (key: string) => {
    delete storage[key];
  },
  clear: () => {
    for (const key of Object.keys(storage)) {
      delete storage[key];
    }
  },
};

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

