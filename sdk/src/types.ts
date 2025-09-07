export interface ReviConfig {
  apiKey: string;
  apiUrl?: string;
  environment?: 'development' | 'staging' | 'production' | string;
  userId?: string;
  release?: string;
  debug?: boolean;
  sampleRate?: number;
  sessionSampleRate?: number;
  maxBreadcrumbs?: number;
  beforeSend?: (event: ErrorEvent) => ErrorEvent | null;
  beforeSendSession?: (session: SessionEvent) => SessionEvent | null;
  // Environment-specific configuration
  developmentHosts?: RegExp[];
  excludeUrls?: RegExp[];
  // Sampling configuration per event type
  sampling?: {
    errorSampleRate?: number;
    sessionSampleRate?: number;
    performanceSampleRate?: number;
    networkSampleRate?: number;
    replaySampleRate?: number;
    debugSampleRate?: number;
  };
  privacy?: {
    maskInputs?: boolean;
    maskPasswords?: boolean;
    maskCreditCards?: boolean;
    allowUrls?: string[];
    denyUrls?: string[];
  };
  performance?: {
    captureWebVitals?: boolean;
    captureResourceTiming?: boolean;
    captureNavigationTiming?: boolean;
  };
  replay?: {
    enabled?: boolean;
    maskAllInputs?: boolean;
    maskAllText?: boolean;
    blockSelector?: string;
    maskSelector?: string;
    maxConsoleEntries?: number;
    captureStackTrace?: boolean;
    serializeObjects?: boolean;
    maxObjectDepth?: number;
    maxStringLength?: number;
    ignoredConsoleLevels?: string[];
    heatmaps?: {
      enabled?: boolean;
      radius?: number;
      maxIntensity?: number;
      blur?: number;
      maxOpacity?: number;
    };
  };
}

export interface DeviceInfo {
  browser_name: string;
  browser_version: string;
  browser_major_version: number;
  os_name: string;
  os_version: string;
  device_type: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  device_fingerprint: string;
  screen_resolution: string;
  color_depth: number;
  device_pixel_ratio: number;
  viewport_size: string;
  platform: string;
  language: string;
  timezone: string;
  canvas_fingerprint?: string;
  webgl_fingerprint?: string;
  cookie_enabled: boolean;
  local_storage_enabled: boolean;
  session_storage_enabled: boolean;
  user_agent: string;
}

export interface ErrorEvent {
  id: string;
  timestamp: number;
  message: string;
  stack?: string;
  url?: string;
  lineno?: number;
  colno?: number;
  filename?: string;
  userId?: string;
  sessionId: string;
  userAgent: string;
  environment?: string;
  release?: string;
  tags?: Record<string, string>;
  extra?: Record<string, any>;
  breadcrumbs?: Breadcrumb[];
  level: 'error' | 'warning' | 'info' | 'debug';
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  // Device information
  deviceInfo?: DeviceInfo;
}

export interface SessionEvent {
  sessionId: string;
  timestamp: number;
  type: string;
  data: Record<string, any>;
  traceId?: string;
  spanId?: string;
  // Device information
  deviceInfo?: DeviceInfo;
}

export interface NetworkEvent {
  sessionId: string;
  timestamp: number;
  method: string;
  url: string;
  statusCode?: number;
  responseTime?: number;
  requestSize?: number;
  responseSize?: number;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  requestBody?: any;
  responseBody?: any;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  // Device information
  deviceInfo?: DeviceInfo;
}

export interface Breadcrumb {
  timestamp: number;
  message: string;
  category: string;
  level: 'error' | 'warning' | 'info' | 'debug';
  data?: Record<string, any>;
}

export interface PerformanceEntry {
  name: string;
  entryType: string;
  startTime: number;
  duration: number;
  [key: string]: any;
}

export interface WebVitals {
  lcp?: number;
  fid?: number;
  cls?: number;
  fcp?: number;
  ttfb?: number;
}

export interface UserContext {
  id?: string;
  email?: string;
  username?: string;
  ipAddress?: string;
  data?: Record<string, any>;
}
