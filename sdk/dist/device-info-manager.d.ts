/**
 * DeviceInfoManager - Centralized device and browser information detection
 * Parses user agent, detects device type, and generates device fingerprints
 */
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
export declare class DeviceInfoManager {
    private static instance;
    private cachedDeviceInfo;
    constructor();
    /**
     * Get comprehensive device information
     */
    getDeviceInfo(): DeviceInfo;
    /**
     * Parse browser information from user agent
     */
    private parseBrowser;
    /**
     * Parse operating system information from user agent
     */
    private parseOperatingSystem;
    /**
     * Detect device type based on user agent and screen size
     */
    private detectDeviceType;
    /**
     * Generate a unique device fingerprint
     */
    private generateDeviceFingerprint;
    /**
     * Generate canvas fingerprint
     */
    private generateCanvasFingerprint;
    /**
     * Generate WebGL fingerprint
     */
    private generateWebGLFingerprint;
    /**
     * Test storage availability
     */
    private testStorageAvailability;
    /**
     * Get server-side device info (fallback)
     */
    private getServerSideDeviceInfo;
    /**
     * Clear cached device info (for testing)
     */
    clearCache(): void;
    /**
     * Get a simplified device summary for logging
     */
    getDeviceSummary(): string;
}
export declare const deviceInfoManager: DeviceInfoManager;
//# sourceMappingURL=device-info-manager.d.ts.map