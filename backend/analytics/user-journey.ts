import { api, Query, Header, APIError } from "encore.dev/api";
import { db } from "./db";
import crypto from 'crypto';

export interface UserJourneyEvent {
  id: number;
  project_id: number;
  user_id?: string;
  user_fingerprint: string;
  session_id: string;
  event_type: 'page_view' | 'error' | 'click' | 'form_submit' | 'api_call' | 'exit';
  url: string;
  referrer?: string;
  timestamp: Date;
  duration_ms?: number;
  metadata: Record<string, any>;
}

export interface CaptureUserEventParams {
  user_id?: string;
  session_id: string;
  event_type: 'page_view' | 'error' | 'click' | 'form_submit' | 'api_call' | 'exit';
  url: string;
  referrer?: string;
  duration_ms?: number;
  metadata?: Record<string, any>;
  user_agent?: string;
  ip_address?: string;
}

interface CaptureUserEventRequest extends CaptureUserEventParams {
  "x-api-key": Header<"X-API-Key">;
}

/**
 * Capture user journey events for analytics
 */
export const captureUserEvent = api<CaptureUserEventRequest, { success: boolean; event_id: number }>(
  { expose: true, method: "POST", path: "/api/analytics/user-event" },
  async (req) => {
    const projectId = await validateApiKey(req["x-api-key"]);
    
    // Generate user fingerprint for anonymous tracking
    const userFingerprint = generateUserFingerprint(
      req.user_agent || '',
      req.ip_address || '',
      req.user_id
    );
    
    // Insert the event
    const result = await db.queryRow<{ id: number }>`
      INSERT INTO user_journey_events (
        project_id, user_id, user_fingerprint, session_id, event_type,
        url, referrer, timestamp, duration_ms, metadata
      ) VALUES (
        ${projectId}, ${req.user_id}, ${userFingerprint}, ${req.session_id},
        ${req.event_type}, ${req.url}, ${req.referrer}, NOW(),
        ${req.duration_ms}, ${JSON.stringify(req.metadata || {})}
      )
      RETURNING id
    `;
    
    if (!result) {
      throw new Error("Failed to capture user event");
    }
    
    // Update or create user analytics record
    await updateUserAnalytics(projectId, req.user_id, userFingerprint, req.user_agent, req.ip_address);
    
    return {
      success: true,
      event_id: result.id
    };
  }
);

export interface GetUserJourneyParams {
  project_id: number;
  user_id?: Query<string>;
  user_fingerprint?: Query<string>;
  session_id?: Query<string>;
  time_range?: Query<'1h' | '24h' | '7d' | '30d'>;
  limit?: Query<number>;
}

export interface UserJourneyResponse {
  events: UserJourneyEvent[];
  user_info: {
    user_id?: string;
    first_seen: Date;
    last_seen: Date;
    total_sessions: number;
    total_errors: number;
    browser_info?: {
      name: string;
      version: string;
      os: string;
    };
    location_info?: {
      country: string;
      city: string;
    };
  };
  journey_insights: {
    common_paths: Array<{
      path: string[];
      frequency: number;
    }>;
    drop_off_points: Array<{
      url: string;
      exit_rate: number;
    }>;
    error_prone_paths: Array<{
      path: string[];
      error_count: number;
    }>;
  };
}

/**
 * Get user journey data and analytics
 */
export const getUserJourney = api<GetUserJourneyParams, UserJourneyResponse>(
  { expose: true, method: "GET", path: "/api/analytics/user-journey/:project_id" },
  async (params) => {
    const timeRange = params.time_range || '24h';
    const limit = Math.min(params.limit || 100, 500);
    
    // Calculate time range
    const endTime = new Date();
    const startTime = new Date();
    
    switch (timeRange) {
      case '1h':
        startTime.setHours(endTime.getHours() - 1);
        break;
      case '24h':
        startTime.setHours(endTime.getHours() - 24);
        break;
      case '7d':
        startTime.setDate(endTime.getDate() - 7);
        break;
      case '30d':
        startTime.setDate(endTime.getDate() - 30);
        break;
    }
    
    let whereConditions = "WHERE project_id = $1 AND timestamp >= $2 AND timestamp <= $3";
    const queryParams: any[] = [params.project_id, startTime, endTime];
    let paramIndex = 4;
    
    if (params.user_id) {
      whereConditions += ` AND user_id = $${paramIndex}`;
      queryParams.push(params.user_id);
      paramIndex++;
    }
    
    if (params.user_fingerprint) {
      whereConditions += ` AND user_fingerprint = $${paramIndex}`;
      queryParams.push(params.user_fingerprint);
      paramIndex++;
    }
    
    if (params.session_id) {
      whereConditions += ` AND session_id = $${paramIndex}`;
      queryParams.push(params.session_id);
      paramIndex++;
    }
    
    // Get journey events
    const eventsQuery = `
      SELECT *
      FROM user_journey_events
      ${whereConditions}
      ORDER BY timestamp ASC
      LIMIT $${paramIndex}
    `;
    
    const events = await db.rawQueryAll<UserJourneyEvent>(eventsQuery, ...queryParams, limit);
    
    // Get user information
    const userInfoQuery = `
      SELECT 
        user_id, first_seen, last_seen, total_sessions, total_errors,
        browser_name, browser_version, os_name, country_code, city
      FROM user_analytics
      WHERE project_id = $1 
      AND (user_id = $2 OR user_fingerprint = $3)
      ORDER BY last_seen DESC
      LIMIT 1
    `;
    
    const userInfo = await db.rawQueryRow<{
      user_id?: string;
      first_seen: Date;
      last_seen: Date;
      total_sessions: number;
      total_errors: number;
      browser_name?: string;
      browser_version?: string;
      os_name?: string;
      country_code?: string;
      city?: string;
    }>(userInfoQuery, params.project_id, params.user_id, params.user_fingerprint);
    
    // Analyze journey patterns
    const journeyInsights = await analyzeJourneyPatterns(params.project_id, events);
    
    return {
      events: events.map(event => ({
        ...event,
        metadata: typeof event.metadata === 'string' ? JSON.parse(event.metadata) : event.metadata
      })),
      user_info: {
        user_id: userInfo?.user_id,
        first_seen: userInfo?.first_seen || new Date(),
        last_seen: userInfo?.last_seen || new Date(),
        total_sessions: userInfo?.total_sessions || 0,
        total_errors: userInfo?.total_errors || 0,
        browser_info: userInfo?.browser_name ? {
          name: userInfo.browser_name,
          version: userInfo.browser_version || '',
          os: userInfo.os_name || ''
        } : undefined,
        location_info: userInfo?.country_code ? {
          country: userInfo.country_code,
          city: userInfo.city || ''
        } : undefined
      },
      journey_insights: journeyInsights
    };
  }
);

/**
 * Get funnel analysis for specific paths
 */
export interface FunnelAnalysisParams {
  project_id: number;
  funnel_steps: string[]; // Array of URLs representing the funnel
  time_range?: '1h' | '24h' | '7d' | '30d';
}

export interface FunnelStep {
  url: string;
  users_entered: number;
  users_completed: number;
  conversion_rate: number;
  avg_time_to_next: number; // in seconds
}

export const getFunnelAnalysis = api<FunnelAnalysisParams, { funnel_steps: FunnelStep[]; overall_conversion: number }>(
  { expose: true, method: "POST", path: "/api/analytics/funnel-analysis/:project_id" },
  async (params) => {
    const timeRange = params.time_range || '24h';
    
    // Calculate time range
    const endTime = new Date();
    const startTime = new Date();
    
    switch (timeRange) {
      case '1h':
        startTime.setHours(endTime.getHours() - 1);
        break;
      case '24h':
        startTime.setHours(endTime.getHours() - 24);
        break;
      case '7d':
        startTime.setDate(endTime.getDate() - 7);
        break;
      case '30d':
        startTime.setDate(endTime.getDate() - 30);
        break;
    }
    
    const funnelSteps: FunnelStep[] = [];
    let previousStepUsers = 0;
    
    for (let i = 0; i < params.funnel_steps.length; i++) {
      const currentUrl = params.funnel_steps[i];
      const nextUrl = params.funnel_steps[i + 1];
      
      // Count users who reached this step
      const usersEnteredQuery = `
        SELECT COUNT(DISTINCT user_fingerprint) as user_count
        FROM user_journey_events
        WHERE project_id = $1 
        AND url = $2
        AND timestamp >= $3 AND timestamp <= $4
      `;
      
      const usersEntered = await db.rawQueryRow<{ user_count: number }>(
        usersEnteredQuery, params.project_id, currentUrl, startTime, endTime
      );
      
      let usersCompleted = 0;
      let avgTimeToNext = 0;
      
      if (nextUrl) {
        // Count users who reached the next step after this one
        const completionQuery = `
          WITH user_sessions AS (
            SELECT DISTINCT user_fingerprint, session_id
            FROM user_journey_events
            WHERE project_id = $1 AND url = $2
            AND timestamp >= $3 AND timestamp <= $4
          ),
          completions AS (
            SELECT us.user_fingerprint,
                   uje1.timestamp as start_time,
                   uje2.timestamp as end_time
            FROM user_sessions us
            JOIN user_journey_events uje1 ON us.user_fingerprint = uje1.user_fingerprint 
                AND us.session_id = uje1.session_id AND uje1.url = $2
            JOIN user_journey_events uje2 ON us.user_fingerprint = uje2.user_fingerprint 
                AND us.session_id = uje2.session_id AND uje2.url = $5
            WHERE uje1.project_id = $1 AND uje2.project_id = $1
            AND uje2.timestamp > uje1.timestamp
            AND uje1.timestamp >= $3 AND uje1.timestamp <= $4
          )
          SELECT COUNT(*) as completed_count,
                 AVG(EXTRACT(EPOCH FROM (end_time - start_time))) as avg_time
          FROM completions
        `;
        
        const completion = await db.rawQueryRow<{ completed_count: number; avg_time: number }>(
          completionQuery, params.project_id, currentUrl, startTime, endTime, nextUrl
        );
        
        usersCompleted = completion?.completed_count || 0;
        avgTimeToNext = completion?.avg_time || 0;
      }
      
      const currentUsersEntered = usersEntered?.user_count || 0;
      const conversionRate = i === 0 ? 100 : (previousStepUsers > 0 ? (currentUsersEntered / previousStepUsers) * 100 : 0);
      
      funnelSteps.push({
        url: currentUrl,
        users_entered: currentUsersEntered,
        users_completed: usersCompleted,
        conversion_rate: Math.round(conversionRate * 100) / 100,
        avg_time_to_next: Math.round(avgTimeToNext * 100) / 100
      });
      
      previousStepUsers = currentUsersEntered;
    }
    
    const overallConversion = funnelSteps.length > 0 && funnelSteps[0].users_entered > 0
      ? (funnelSteps[funnelSteps.length - 1].users_entered / funnelSteps[0].users_entered) * 100
      : 0;
    
    return {
      funnel_steps: funnelSteps,
      overall_conversion: Math.round(overallConversion * 100) / 100
    };
  }
);

/**
 * Helper function to validate API key
 */
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

/**
 * Generate user fingerprint for anonymous tracking
 */
function generateUserFingerprint(userAgent: string, ipAddress: string, userId?: string): string {
  const data = `${userAgent}|${ipAddress}|${userId || 'anonymous'}`;
  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
}

/**
 * Update or create user analytics record
 */
async function updateUserAnalytics(
  projectId: number, 
  userId?: string, 
  userFingerprint?: string,
  userAgent?: string,
  ipAddress?: string
): Promise<void> {
  // Parse user agent for browser and OS info
  let browserInfo = { name: '', version: '', os: '' };
  if (userAgent) {
    browserInfo = parseUserAgent(userAgent);
  }
  
  // Simple IP to country lookup (in production, use a proper GeoIP service)
  const locationInfo = { country: '', city: '' };
  
  // Use fingerprint as user_id if no actual user_id is provided (for anonymous users)
  const effectiveUserId = userId || userFingerprint || 'anonymous';
  
  await db.exec`
    INSERT INTO user_analytics (
      project_id, user_id, user_fingerprint, last_seen, total_sessions,
      browser_name, browser_version, os_name, country_code, city, user_agent
    ) VALUES (
      ${projectId}, ${effectiveUserId}, ${userFingerprint}, NOW(), 1,
      ${browserInfo.name}, ${browserInfo.version}, ${browserInfo.os},
      ${locationInfo.country}, ${locationInfo.city}, ${userAgent}
    )
    ON CONFLICT (project_id, user_id)
    DO UPDATE SET
      last_seen = NOW(),
      total_sessions = user_analytics.total_sessions + 1,
      browser_name = COALESCE(user_analytics.browser_name, ${browserInfo.name}),
      browser_version = COALESCE(user_analytics.browser_version, ${browserInfo.version}),
      os_name = COALESCE(user_analytics.os_name, ${browserInfo.os}),
      updated_at = NOW()
  `;
}

/**
 * Parse user agent string to extract browser and OS information
 */
function parseUserAgent(userAgent: string): { name: string; version: string; os: string } {
  const browserMatch = userAgent.match(/(Chrome|Firefox|Safari|Edge)\/([0-9.]+)/);
  const osMatch = userAgent.match(/\(([^)]+)\)/);
  
  return {
    name: browserMatch ? browserMatch[1] : 'Unknown',
    version: browserMatch ? browserMatch[2] : '',
    os: osMatch ? osMatch[1].split(';')[0].trim() : 'Unknown'
  };
}

/**
 * Analyze journey patterns to find common paths and drop-offs
 */
async function analyzeJourneyPatterns(
  projectId: number, 
  events: UserJourneyEvent[]
): Promise<{
  common_paths: Array<{ path: string[]; frequency: number }>;
  drop_off_points: Array<{ url: string; exit_rate: number }>;
  error_prone_paths: Array<{ path: string[]; error_count: number }>;
}> {
  // Group events by session to analyze paths
  const sessionPaths = new Map<string, string[]>();
  const urlVisits = new Map<string, number>();
  const urlExits = new Map<string, number>();
  
  events.forEach(event => {
    if (!sessionPaths.has(event.session_id)) {
      sessionPaths.set(event.session_id, []);
    }
    sessionPaths.get(event.session_id)!.push(event.url);
    
    // Count visits
    urlVisits.set(event.url, (urlVisits.get(event.url) || 0) + 1);
  });
  
  // Find common paths (sequences of 3+ pages)
  const pathCounts = new Map<string, number>();
  sessionPaths.forEach(path => {
    for (let i = 0; i <= path.length - 3; i++) {
      const sequence = path.slice(i, i + 3);
      const key = sequence.join(' → ');
      pathCounts.set(key, (pathCounts.get(key) || 0) + 1);
    }
  });
  
  const commonPaths = Array.from(pathCounts.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([path, frequency]) => ({
      path: path.split(' → '),
      frequency
    }));
  
  // Calculate drop-off points (simplified - just look at last page in sessions)
  sessionPaths.forEach(path => {
    if (path.length > 0) {
      const lastUrl = path[path.length - 1];
      urlExits.set(lastUrl, (urlExits.get(lastUrl) || 0) + 1);
    }
  });
  
  const dropOffPoints = Array.from(urlExits.entries())
    .map(([url, exits]) => {
      const visits = urlVisits.get(url) || 1;
      return {
        url,
        exit_rate: Math.round((exits / visits) * 10000) / 100 // Percentage with 2 decimals
      };
    })
    .sort((a, b) => b.exit_rate - a.exit_rate)
    .slice(0, 10);
  
  // Error-prone paths (would require error data correlation)
  const errorPronePaths: Array<{ path: string[]; error_count: number }> = [];
  
  return {
    common_paths: commonPaths,
    drop_off_points: dropOffPoints,
    error_prone_paths: errorPronePaths
  };
}