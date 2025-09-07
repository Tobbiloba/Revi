import { api, Header, APIError } from "encore.dev/api";
import { db } from "./db";

export interface DeviceRegistrationRequest {
  device_info: {
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
  };
  session_id?: string;
  user_id?: string;
}

export interface DeviceRegistrationResponse {
  success: boolean;
  device_id?: number;
  message?: string;
}

interface DeviceRegistrationParams extends DeviceRegistrationRequest {
  "x-api-key": Header<"X-API-Key">;
}

// Register device information when SDK initializes
export const registerDevice = api<DeviceRegistrationParams, DeviceRegistrationResponse>(
  { expose: true, method: "POST", path: "/api/capture/device" },
  async (req) => {
    const projectId = await validateApiKey(req["x-api-key"]);
    
    const deviceInfo = req.device_info;
    
    try {
      // Register or update device analytics
      await db.queryRow`
        INSERT INTO device_analytics (
          project_id, device_fingerprint, device_type, browser_name, browser_version,
          os_name, os_version, screen_resolution, color_depth, platform,
          language, timezone, user_agent, first_seen, last_seen, total_sessions,
          total_page_views, total_errors, metadata, created_at, updated_at
        )
        VALUES (
          ${projectId}, ${deviceInfo.device_fingerprint}, ${deviceInfo.device_type},
          ${deviceInfo.browser_name}, ${deviceInfo.browser_version}, ${deviceInfo.os_name},
          ${deviceInfo.os_version}, ${deviceInfo.screen_resolution}, ${deviceInfo.color_depth},
          ${deviceInfo.platform}, ${deviceInfo.language}, ${deviceInfo.timezone},
          ${deviceInfo.browser_name + ' ' + deviceInfo.browser_version}, NOW(), NOW(), 1, 0, 0,
          ${JSON.stringify({
            device_pixel_ratio: deviceInfo.device_pixel_ratio,
            viewport_size: deviceInfo.viewport_size,
            canvas_fingerprint: deviceInfo.canvas_fingerprint,
            webgl_fingerprint: deviceInfo.webgl_fingerprint,
            cookie_enabled: deviceInfo.cookie_enabled,
            local_storage_enabled: deviceInfo.local_storage_enabled,
            session_storage_enabled: deviceInfo.session_storage_enabled
          })}, NOW(), NOW()
        )
        ON CONFLICT (project_id, device_fingerprint) DO UPDATE SET
          last_seen = NOW(),
          total_sessions = device_analytics.total_sessions + 1,
          browser_name = COALESCE(device_analytics.browser_name, ${deviceInfo.browser_name}),
          browser_version = COALESCE(device_analytics.browser_version, ${deviceInfo.browser_version}),
          os_name = COALESCE(device_analytics.os_name, ${deviceInfo.os_name}),
          os_version = COALESCE(device_analytics.os_version, ${deviceInfo.os_version}),
          device_type = COALESCE(device_analytics.device_type, ${deviceInfo.device_type}),
          updated_at = NOW()
        RETURNING id
      `;

      // Update user analytics if we have user information
      if (req.user_id) {
        await db.queryRow`
          INSERT INTO user_analytics (
            project_id, user_id, user_fingerprint, first_seen, last_seen,
            total_sessions, total_errors, total_page_views, browser_name, browser_version,
            os_name, os_version, device_type, language, timezone, user_agent,
            metadata, created_at, updated_at
          )
          VALUES (
            ${projectId}, ${req.user_id}, ${deviceInfo.device_fingerprint},
            NOW(), NOW(), 1, 0, 0, ${deviceInfo.browser_name}, ${deviceInfo.browser_version},
            ${deviceInfo.os_name}, ${deviceInfo.os_version}, ${deviceInfo.device_type},
            ${deviceInfo.language}, ${deviceInfo.timezone}, ${deviceInfo.browser_name + ' ' + deviceInfo.browser_version},
            ${JSON.stringify({ device_fingerprint: deviceInfo.device_fingerprint })}, NOW(), NOW()
          )
          ON CONFLICT (project_id, user_id) DO UPDATE SET
            last_seen = NOW(),
            total_sessions = user_analytics.total_sessions + 1,
            browser_name = COALESCE(user_analytics.browser_name, ${deviceInfo.browser_name}),
            browser_version = COALESCE(user_analytics.browser_version, ${deviceInfo.browser_version}),
            os_name = COALESCE(user_analytics.os_name, ${deviceInfo.os_name}),
            os_version = COALESCE(user_analytics.os_version, ${deviceInfo.os_version}),
            device_type = COALESCE(user_analytics.device_type, ${deviceInfo.device_type}),
            updated_at = NOW()
        `;
      }

      return {
        success: true,
        message: "Device registered successfully"
      };
      
    } catch (error) {
      console.error('Device registration failed:', error);
      throw APIError.internal("Failed to register device");
    }
  }
);

async function validateApiKey(apiKey: string): Promise<number> {
  if (!apiKey) {
    throw APIError.unauthenticated("missing API key");
  }
  
  const project = await db.queryRow<{ id: number }>`
    SELECT id FROM projects WHERE api_key = ${apiKey}
  `;
  
  if (!project) {
    throw APIError.unauthenticated("invalid API key");
  }
  
  return project.id;
}