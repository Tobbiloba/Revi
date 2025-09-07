/**
 * DeviceInfoManager - Centralized device and browser information detection
 * Parses user agent, detects device type, and generates device fingerprints
 */

import { generateId } from './utils';

export interface DeviceInfo {
  // Browser information
  browser_name: string;
  browser_version: string;
  browser_major_version: number;
  
  // Operating system
  os_name: string;
  os_version: string;
  
  // Device information
  device_type: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  device_fingerprint: string;
  
  // Display information
  screen_resolution: string;
  color_depth: number;
  device_pixel_ratio: number;
  viewport_size: string;
  
  // Environment
  platform: string;
  language: string;
  timezone: string;
  
  // Advanced fingerprinting
  canvas_fingerprint?: string;
  webgl_fingerprint?: string;
  
  // Capabilities
  cookie_enabled: boolean;
  local_storage_enabled: boolean;
  session_storage_enabled: boolean;
  
  // Raw data
  user_agent: string;
}

export class DeviceInfoManager {
  private static instance: DeviceInfoManager;
  private cachedDeviceInfo: DeviceInfo | null = null;

  constructor() {
    if (DeviceInfoManager.instance) {
      return DeviceInfoManager.instance;
    }
    DeviceInfoManager.instance = this;
  }

  /**
   * Get comprehensive device information
   */
  getDeviceInfo(): DeviceInfo {
    if (this.cachedDeviceInfo) {
      return this.cachedDeviceInfo;
    }

    if (typeof window === 'undefined') {
      return this.getServerSideDeviceInfo();
    }

    const userAgent = navigator.userAgent;
    const browserInfo = this.parseBrowser(userAgent);
    const osInfo = this.parseOperatingSystem(userAgent);
    const deviceType = this.detectDeviceType(userAgent);

    this.cachedDeviceInfo = {
      // Browser information
      browser_name: browserInfo.name,
      browser_version: browserInfo.version,
      browser_major_version: browserInfo.majorVersion,
      
      // Operating system
      os_name: osInfo.name,
      os_version: osInfo.version,
      
      // Device information
      device_type: deviceType,
      device_fingerprint: this.generateDeviceFingerprint(),
      
      // Display information
      screen_resolution: `${screen.width}x${screen.height}`,
      color_depth: screen.colorDepth,
      device_pixel_ratio: window.devicePixelRatio || 1,
      viewport_size: `${window.innerWidth}x${window.innerHeight}`,
      
      // Environment
      platform: navigator.platform,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      
      // Advanced fingerprinting
      canvas_fingerprint: this.generateCanvasFingerprint(),
      webgl_fingerprint: this.generateWebGLFingerprint(),
      
      // Capabilities
      cookie_enabled: navigator.cookieEnabled,
      local_storage_enabled: this.testStorageAvailability('localStorage'),
      session_storage_enabled: this.testStorageAvailability('sessionStorage'),
      
      // Raw data
      user_agent: userAgent
    };

    return this.cachedDeviceInfo;
  }

  /**
   * Parse browser information from user agent
   */
  private parseBrowser(userAgent: string): { name: string; version: string; majorVersion: number } {
    const browsers = [
      { name: 'Chrome', regex: /Chrome\/([0-9.]+)/ },
      { name: 'Firefox', regex: /Firefox\/([0-9.]+)/ },
      { name: 'Safari', regex: /Safari\/[0-9.]+ Version\/([0-9.]+)/ },
      { name: 'Edge', regex: /Edg\/([0-9.]+)/ },
      { name: 'Opera', regex: /Opera\/([0-9.]+)/ },
      { name: 'Internet Explorer', regex: /MSIE ([0-9.]+)/ },
      { name: 'Internet Explorer', regex: /Trident\/.*rv:([0-9.]+)/ }
    ];

    for (const browser of browsers) {
      const match = userAgent.match(browser.regex);
      if (match) {
        const version = match[1];
        const majorVersion = parseInt(version.split('.')[0], 10);
        return {
          name: browser.name,
          version,
          majorVersion: isNaN(majorVersion) ? 0 : majorVersion
        };
      }
    }

    return { name: 'Unknown', version: '', majorVersion: 0 };
  }

  /**
   * Parse operating system information from user agent
   */
  private parseOperatingSystem(userAgent: string): { name: string; version: string } {
    // Debug logging
    if (typeof console !== 'undefined' && console.log) {
      console.log('[DeviceInfoManager] Parsing OS from UA:', userAgent);
      console.log('[DeviceInfoManager] Platform:', typeof navigator !== 'undefined' ? navigator.platform : 'undefined');
    }

    // Use platform as a primary indicator for desktop systems
    if (typeof navigator !== 'undefined' && navigator.platform) {
      const platform = navigator.platform;
      if (platform.includes('Mac') || platform === 'MacIntel') {
        // This is definitely macOS
        const macVersionMatch = userAgent.match(/Mac OS X ([0-9._]+)/);
        const version = macVersionMatch ? macVersionMatch[1].replace(/_/g, '.') : '';
        if (typeof console !== 'undefined' && console.log) {
          console.log('[DeviceInfoManager] Platform-based detection: macOS', version);
        }
        return { name: 'macOS', version };
      }
      
      if (platform.includes('Win') || platform.startsWith('Win')) {
        // This is Windows
        const winVersionMatch = userAgent.match(/Windows NT ([0-9.]+)/);
        const version = winVersionMatch ? winVersionMatch[1] : '';
        return { name: 'Windows', version };
      }
      
      if (platform.includes('Linux') && !userAgent.includes('Android')) {
        // This is Linux desktop
        return { name: 'Linux', version: '' };
      }
    }

    // Fallback to user agent parsing
    const systems = [
      // Windows - check first for most specific versions
      { name: 'Windows 11', regex: /Windows NT 10\.0.*Win64.*x64/ },
      { name: 'Windows 10', regex: /Windows NT 10\.0/ },
      { name: 'Windows 8.1', regex: /Windows NT 6\.3/ },
      { name: 'Windows 8', regex: /Windows NT 6\.2/ },
      { name: 'Windows 7', regex: /Windows NT 6\.1/ },
      { name: 'Windows Vista', regex: /Windows NT 6\.0/ },
      { name: 'Windows XP', regex: /Windows NT 5\.1/ },
      { name: 'Windows', regex: /Windows NT ([0-9.]+)/ },
      
      // macOS - check before more generic patterns
      { name: 'macOS', regex: /Mac OS X ([0-9._]+)/ },
      { name: 'macOS', regex: /Macintosh.*Mac OS X/ },
      
      // iOS - specific mobile patterns (very specific to avoid false positives)
      { name: 'iOS', regex: /iPhone.*OS ([0-9_]+)/ },
      { name: 'iOS', regex: /iPad.*OS ([0-9_]+)/ },
      { name: 'iOS', regex: /iPod.*OS ([0-9_]+)/ },
      
      // ChromeOS
      { name: 'ChromeOS', regex: /CrOS/ },
      
      // Android - be very specific to avoid false positives
      { name: 'Android', regex: /Android ([0-9.]+)(?!.*Mac)/ },
      
      // Linux variants
      { name: 'Ubuntu', regex: /Ubuntu/ },
      { name: 'Linux', regex: /Linux(?!.*Android)/ }
    ];

    for (const system of systems) {
      const match = userAgent.match(system.regex);
      if (match) {
        let version = '';
        if (match[1]) {
          version = match[1].replace(/_/g, '.');
        }
        if (typeof console !== 'undefined' && console.log) {
          console.log('[DeviceInfoManager] UA-based detection:', system.name, version);
        }
        return { name: system.name, version };
      }
    }

    if (typeof console !== 'undefined' && console.log) {
      console.log('[DeviceInfoManager] No OS match found, returning Unknown');
    }
    return { name: 'Unknown', version: '' };
  }

  /**
   * Detect device type based on user agent and screen size
   */
  private detectDeviceType(userAgent: string): 'desktop' | 'mobile' | 'tablet' | 'unknown' {
    // First, check for desktop OS indicators (highest priority)
    const desktopIndicators = [
      /Windows NT/i,
      /Mac OS X/i,
      /MacIntel/i,
      /Linux.*X11/i,
      /CrOS/i  // ChromeOS
    ];

    // If we detect desktop OS, it's very likely desktop unless explicitly mobile
    if (desktopIndicators.some(pattern => pattern.test(userAgent))) {
      // Only override if we have clear mobile indicators
      const mobileBrowsers = [
        /Mobile Safari/i,
        /Android.*Mobile/i,
        /iPhone/i,
        /iPod/i,
        /Windows Phone/i
      ];
      
      if (!mobileBrowsers.some(pattern => pattern.test(userAgent))) {
        return 'desktop';
      }
    }

    // Check for specific mobile patterns
    const mobilePatterns = [
      /iPhone/i,
      /iPod/i,
      /Android.*Mobile/i,
      /BlackBerry/i,
      /Windows Phone/i,
      /Opera Mini/i,
      /Mobile.*Safari/i
    ];

    // Check for tablet patterns (more specific)
    const tabletPatterns = [
      /iPad/i,
      /Android(?!.*Mobile)/i,
      /Tablet/i,
      /Kindle/i,
      /Silk/i,
      /PlayBook/i
    ];

    // Check screen size if available (secondary indicator)
    if (typeof screen !== 'undefined') {
      const screenWidth = Math.max(screen.width, screen.height);
      // const screenHeight = Math.min(screen.width, screen.height);
      
      // Very small screens are likely mobile
      if (screenWidth <= 480) {
        return 'mobile';
      }
      
      // Large screens are likely desktop
      if (screenWidth >= 1280) {
        return 'desktop';
      }
      
      // Medium screens - check patterns
      if (screenWidth <= 1024) {
        if (tabletPatterns.some(pattern => pattern.test(userAgent))) {
          return 'tablet';
        }
        if (mobilePatterns.some(pattern => pattern.test(userAgent))) {
          return 'mobile';
        }
      }
    }

    // Check user agent patterns
    if (mobilePatterns.some(pattern => pattern.test(userAgent))) {
      return 'mobile';
    }

    if (tabletPatterns.some(pattern => pattern.test(userAgent))) {
      return 'tablet';
    }

    // Default to desktop for everything else
    return 'desktop';
  }

  /**
   * Generate a unique device fingerprint
   */
  private generateDeviceFingerprint(): string {
    if (typeof window === 'undefined') {
      return 'server-' + generateId();
    }

    const components = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      screen.colorDepth,
      navigator.platform,
      navigator.cookieEnabled.toString(),
      typeof window.localStorage !== 'undefined',
      typeof window.sessionStorage !== 'undefined',
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      navigator.hardwareConcurrency || 'unknown',
      window.devicePixelRatio || 1
    ];

    // Add canvas fingerprint if available
    const canvasFingerprint = this.generateCanvasFingerprint();
    if (canvasFingerprint) {
      components.push(canvasFingerprint);
    }

    // Add WebGL fingerprint if available
    const webglFingerprint = this.generateWebGLFingerprint();
    if (webglFingerprint) {
      components.push(webglFingerprint);
    }

    // Simple hash function for browser compatibility
    const str = components.join('|');
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return 'fp_' + Math.abs(hash).toString(36);
  }

  /**
   * Generate canvas fingerprint
   */
  private generateCanvasFingerprint(): string | undefined {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) return undefined;

      canvas.width = 200;
      canvas.height = 50;
      
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('Device fingerprint 🔒', 2, 15);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.fillText('Device fingerprint 🔒', 4, 17);

      return canvas.toDataURL();
    } catch {
      return undefined;
    }
  }

  /**
   * Generate WebGL fingerprint
   */
  private generateWebGLFingerprint(): string | undefined {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl') as WebGLRenderingContext;
      
      if (!gl) return undefined;

      const renderer = gl.getParameter(gl.RENDERER);
      const vendor = gl.getParameter(gl.VENDOR);
      const version = gl.getParameter(gl.VERSION);
      const extensions = gl.getSupportedExtensions()?.join(',') || '';

      return `${vendor}|${renderer}|${version}|${extensions}`;
    } catch {
      return undefined;
    }
  }

  /**
   * Test storage availability
   */
  private testStorageAvailability(type: 'localStorage' | 'sessionStorage'): boolean {
    try {
      const storage = window[type];
      const testKey = '__revi_test__';
      storage.setItem(testKey, 'test');
      storage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get server-side device info (fallback)
   */
  private getServerSideDeviceInfo(): DeviceInfo {
    return {
      browser_name: 'Unknown',
      browser_version: '',
      browser_major_version: 0,
      os_name: 'Unknown',
      os_version: '',
      device_type: 'unknown',
      device_fingerprint: 'server-' + generateId(),
      screen_resolution: 'unknown',
      color_depth: 0,
      device_pixel_ratio: 1,
      viewport_size: 'unknown',
      platform: 'server',
      language: 'unknown',
      timezone: 'unknown',
      cookie_enabled: false,
      local_storage_enabled: false,
      session_storage_enabled: false,
      user_agent: 'server'
    };
  }

  /**
   * Clear cached device info (for testing)
   */
  clearCache(): void {
    this.cachedDeviceInfo = null;
  }

  /**
   * Get a simplified device summary for logging
   */
  getDeviceSummary(): string {
    const info = this.getDeviceInfo();
    return `${info.browser_name} ${info.browser_version} on ${info.os_name} (${info.device_type})`;
  }
}

// Export singleton instance
export const deviceInfoManager = new DeviceInfoManager();