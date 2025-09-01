export function generateId(): string {
  return 'xxxx-xxxx-4xxx-yxxx-xxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function formatStackTrace(error: Error): string {
  if (!error.stack) return '';
  
  return error.stack
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');
}

export function sanitizeUrl(url: string, allowUrls: string[] = [], denyUrls: string[] = []): string {
  // Check deny list first
  if (denyUrls.some(pattern => new RegExp(pattern).test(url))) {
    return '[Filtered]';
  }
  
  // If allow list is provided, ensure URL matches
  if (allowUrls.length > 0 && !allowUrls.some(pattern => new RegExp(pattern).test(url))) {
    return '[Filtered]';
  }
  
  // Remove sensitive query parameters
  try {
    const urlObj = new URL(url);
    const sensitiveParams = ['password', 'token', 'key', 'secret', 'auth', 'api_key'];
    
    sensitiveParams.forEach(param => {
      if (urlObj.searchParams.has(param)) {
        urlObj.searchParams.set(param, '[Filtered]');
      }
    });
    
    return urlObj.toString();
  } catch {
    return url;
  }
}

export function maskSensitiveData(data: any, maskInputs = true): any {
  if (typeof data !== 'object' || data === null) {
    return data;
  }
  
  if (Array.isArray(data)) {
    return data.map(item => maskSensitiveData(item, maskInputs));
  }
  
  const masked: any = {};
  const sensitiveKeys = ['password', 'token', 'key', 'secret', 'auth', 'api_key', 'credit_card', 'ssn'];
  
  Object.keys(data).forEach(key => {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
      masked[key] = '[Masked]';
    } else if (typeof data[key] === 'object') {
      masked[key] = maskSensitiveData(data[key], maskInputs);
    } else {
      masked[key] = data[key];
    }
  });
  
  return masked;
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

export function isBot(): boolean {
  if (typeof navigator === 'undefined') return false;
  
  const botPatterns = [
    /bot/i,
    /spider/i,
    /crawl/i,
    /headless/i,
    /phantom/i,
    /selenium/i
  ];
  
  return botPatterns.some(pattern => pattern.test(navigator.userAgent));
}

export function getSessionStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem('test', 'test');
      window.sessionStorage.removeItem('test');
      return window.sessionStorage;
    }
  } catch {
    // Storage not available
  }
  return null;
}

export function getLocalStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('test', 'test');
      window.localStorage.removeItem('test');
      return window.localStorage;
    }
  } catch {
    // Storage not available
  }
  return null;
}
