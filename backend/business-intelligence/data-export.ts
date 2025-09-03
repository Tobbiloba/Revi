import { api } from "encore.dev/api";
import { CronJob } from "encore.dev/cron";
import { db } from "./db";

export interface DataExportRequest {
  project_id: number;
  dashboard_id?: number;
  export_type: 'csv' | 'json' | 'pdf' | 'excel';
  data_source: 'errors' | 'sessions' | 'performance' | 'users' | 'alerts' | 'custom_query';
  filters?: Record<string, any>;
  time_range?: { start: string; end: string };
  columns?: string[];
  custom_query?: string;
  format_options?: {
    include_headers?: boolean;
    delimiter?: string;
    date_format?: string;
    number_format?: string;
  };
  created_by: string;
}

export interface DataExportResult {
  id: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  file_url?: string;
  file_size?: number;
  error_message?: string;
  expires_at?: Date;
}

/**
 * Create data export request
 */
export const createDataExport = api<DataExportRequest, DataExportResult>(
  { expose: true, method: "POST", path: "/api/business-intelligence/exports" },
  async (params) => {
    // Validate export request
    await validateExportRequest(params);

    const exportRecord = await db.queryRow<{
      id: number;
      status: string;
      expires_at: Date;
    }>`
      INSERT INTO dashboard_exports (
        dashboard_id, project_id, export_type, export_format,
        filters, time_range, created_by, expires_at
      ) VALUES (
        ${params.dashboard_id}, ${params.project_id}, ${params.export_type},
        ${JSON.stringify(params.format_options || {})},
        ${JSON.stringify(params.filters || {})},
        ${JSON.stringify(params.time_range || {})},
        ${params.created_by},
        NOW() + INTERVAL '7 days'
      )
      RETURNING id, status, expires_at
    `;

    if (!exportRecord) {
      throw new Error("Failed to create export request");
    }

    // Queue export processing (in a real system, this would go to a job queue)
    setTimeout(() => {
      processExportRequest(exportRecord.id, params).catch(error => {
        console.error(`Export processing failed for ${exportRecord.id}:`, error);
      });
    }, 100);

    return {
      id: exportRecord.id,
      status: exportRecord.status as any,
      expires_at: exportRecord.expires_at
    };
  }
);

/**
 * Get export status and download URL
 */
export const getDataExport = api<{
  export_id: number;
}, DataExportResult>(
  { expose: true, method: "GET", path: "/api/business-intelligence/exports/:export_id" },
  async (params) => {
    const exportRecord = await db.queryRow<{
      id: number;
      status: string;
      file_url?: string;
      file_size?: number;
      error_message?: string;
      expires_at: Date;
    }>`
      SELECT id, status, file_url, file_size, error_message, expires_at
      FROM dashboard_exports 
      WHERE id = ${params.export_id}
    `;

    if (!exportRecord) {
      throw new Error("Export not found");
    }

    return {
      id: exportRecord.id,
      status: exportRecord.status as any,
      file_url: exportRecord.file_url,
      file_size: exportRecord.file_size,
      error_message: exportRecord.error_message,
      expires_at: exportRecord.expires_at
    };
  }
);

/**
 * List user's exports
 */
export const getUserExports = api<{
  project_id: number;
  created_by: string;
  limit?: number;
}, { exports: DataExportResult[] }>(
  { expose: true, method: "GET", path: "/api/business-intelligence/exports/user/:created_by" },
  async (params) => {
    const limit = Math.min(params.limit || 50, 100);

    const exports = await db.queryAll<{
      id: number;
      status: string;
      file_url?: string;
      file_size?: number;
      error_message?: string;
      expires_at: Date;
    }>`
      SELECT id, status, file_url, file_size, error_message, expires_at
      FROM dashboard_exports
      WHERE project_id = ${params.project_id}
      AND created_by = ${params.created_by}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    return {
      exports: exports.map(exp => ({
        id: exp.id,
        status: exp.status as any,
        file_url: exp.file_url,
        file_size: exp.file_size,
        error_message: exp.error_message,
        expires_at: exp.expires_at
      }))
    };
  }
);

/**
 * Process export request (background processing)
 */
async function processExportRequest(exportId: number, request: DataExportRequest): Promise<void> {
  try {
    // Mark as processing
    await db.exec`
      UPDATE dashboard_exports
      SET status = 'processing', updated_at = NOW()
      WHERE id = ${exportId}
    `;

    // Execute data query
    const data = await executeExportQuery(request);
    
    // Generate export file
    const fileResult = await generateExportFile(data, request);
    
    // Update record with success
    await db.exec`
      UPDATE dashboard_exports
      SET status = 'completed', 
          file_url = ${fileResult.url},
          file_size = ${fileResult.size},
          updated_at = NOW()
      WHERE id = ${exportId}
    `;

    console.log(`Export ${exportId} completed successfully`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await db.exec`
      UPDATE dashboard_exports
      SET status = 'failed',
          error_message = ${errorMessage},
          updated_at = NOW()
      WHERE id = ${exportId}
    `;

    console.error(`Export ${exportId} failed:`, error);
  }
}

/**
 * Execute query for export data
 */
async function executeExportQuery(request: DataExportRequest): Promise<any[]> {
  let query = '';
  const params: any[] = [];
  let paramIndex = 1;

  // Build base query
  switch (request.data_source) {
    case 'errors':
      query = 'SELECT * FROM errors WHERE 1=1';
      break;
    case 'sessions':
      query = 'SELECT * FROM sessions WHERE 1=1';
      break;
    case 'performance':
      query = 'SELECT * FROM performance_metrics WHERE 1=1';
      break;
    case 'alerts':
      query = 'SELECT * FROM alert_history WHERE 1=1';
      break;
    case 'users':
      query = 'SELECT DISTINCT user_fingerprint, COUNT(*) as session_count FROM sessions WHERE 1=1 GROUP BY user_fingerprint';
      break;
    case 'custom_query':
      if (!request.custom_query) {
        throw new Error('Custom query not provided');
      }
      query = request.custom_query;
      break;
    default:
      throw new Error(`Unsupported data source: ${request.data_source}`);
  }

  // Add project filter
  if (request.data_source !== 'custom_query') {
    query += ` AND project_id = $${paramIndex}`;
    params.push(request.project_id);
    paramIndex++;
  }

  // Add time range filter
  if (request.time_range) {
    query += ` AND timestamp BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
    params.push(request.time_range.start, request.time_range.end);
    paramIndex += 2;
  }

  // Add custom filters
  if (request.filters) {
    Object.entries(request.filters).forEach(([key, value]) => {
      if (value != null && value !== '') {
        if (Array.isArray(value)) {
          query += ` AND ${key} = ANY($${paramIndex})`;
          params.push(value);
        } else {
          query += ` AND ${key} = $${paramIndex}`;
          params.push(value);
        }
        paramIndex++;
      }
    });
  }

  // Add column selection
  if (request.columns && request.columns.length > 0) {
    const selectColumns = request.columns.join(', ');
    query = query.replace('SELECT *', `SELECT ${selectColumns}`);
  }

  // Add order and limit
  if (request.data_source !== 'custom_query') {
    query += ' ORDER BY timestamp DESC LIMIT 10000'; // Reasonable limit
  }

  console.log('Executing export query:', query);
  
  const results = await db.rawQueryAll<any>(query, ...params);
  
  if (results.length === 0) {
    console.warn('Export query returned no results');
  }

  return results;
}

/**
 * Generate export file
 */
async function generateExportFile(
  data: any[],
  request: DataExportRequest
): Promise<{ url: string; size: number }> {
  const filename = `export-${Date.now()}.${request.export_type}`;
  let content: string;
  let contentType: string;

  switch (request.export_type) {
    case 'csv':
      content = generateCSV(data, request.format_options);
      contentType = 'text/csv';
      break;
    case 'json':
      content = JSON.stringify(data, null, 2);
      contentType = 'application/json';
      break;
    case 'excel':
      // In a real implementation, you'd use a library like xlsx
      content = generateCSV(data, request.format_options); // Fallback to CSV
      contentType = 'text/csv';
      break;
    case 'pdf':
      // In a real implementation, you'd use a library like puppeteer or pdfkit
      content = generateTextReport(data, request);
      contentType = 'text/plain';
      break;
    default:
      throw new Error(`Unsupported export type: ${request.export_type}`);
  }

  // In a real system, you'd upload to cloud storage (S3, GCS, etc.)
  // For this demo, we'll simulate the file storage
  const mockUrl = `https://storage.revi.com/exports/${filename}`;
  const size = Buffer.from(content, 'utf8').length;

  console.log(`Generated export file: ${filename}, size: ${size} bytes`);

  return {
    url: mockUrl,
    size: size
  };
}

/**
 * Generate CSV content
 */
function generateCSV(data: any[], formatOptions?: DataExportRequest['format_options']): string {
  if (data.length === 0) {
    return '';
  }

  const delimiter = formatOptions?.delimiter || ',';
  const includeHeaders = formatOptions?.include_headers !== false;
  
  const headers = Object.keys(data[0]);
  const rows: string[] = [];

  if (includeHeaders) {
    rows.push(headers.map(header => escapeCSVField(header)).join(delimiter));
  }

  data.forEach(row => {
    const values = headers.map(header => {
      let value = row[header];
      
      // Format dates
      if (value instanceof Date) {
        value = formatOptions?.date_format === 'iso' 
          ? value.toISOString()
          : value.toLocaleString();
      }
      
      // Format numbers
      if (typeof value === 'number' && formatOptions?.number_format) {
        value = value.toLocaleString();
      }
      
      return escapeCSVField(String(value || ''));
    });
    
    rows.push(values.join(delimiter));
  });

  return rows.join('\n');
}

/**
 * Escape CSV field
 */
function escapeCSVField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

/**
 * Generate text report for PDF fallback
 */
function generateTextReport(data: any[], request: DataExportRequest): string {
  const lines: string[] = [];
  
  lines.push('REVI DATA EXPORT REPORT');
  lines.push('='.repeat(50));
  lines.push('');
  lines.push(`Export Date: ${new Date().toLocaleString()}`);
  lines.push(`Data Source: ${request.data_source}`);
  lines.push(`Total Records: ${data.length}`);
  
  if (request.time_range) {
    lines.push(`Time Range: ${request.time_range.start} to ${request.time_range.end}`);
  }
  
  lines.push('');
  lines.push('SUMMARY STATISTICS');
  lines.push('-'.repeat(30));
  
  if (data.length > 0) {
    const headers = Object.keys(data[0]);
    
    // Generate basic statistics
    headers.forEach(header => {
      const values = data.map(row => row[header]).filter(v => v != null);
      
      if (values.length === 0) return;
      
      lines.push(`${header}:`);
      
      if (typeof values[0] === 'number') {
        const numbers = values as number[];
        const sum = numbers.reduce((a, b) => a + b, 0);
        const avg = sum / numbers.length;
        const min = Math.min(...numbers);
        const max = Math.max(...numbers);
        
        lines.push(`  Count: ${numbers.length}`);
        lines.push(`  Sum: ${sum}`);
        lines.push(`  Average: ${avg.toFixed(2)}`);
        lines.push(`  Min: ${min}`);
        lines.push(`  Max: ${max}`);
      } else {
        const uniqueValues = [...new Set(values)];
        lines.push(`  Count: ${values.length}`);
        lines.push(`  Unique Values: ${uniqueValues.length}`);
        if (uniqueValues.length <= 10) {
          lines.push(`  Values: ${uniqueValues.join(', ')}`);
        }
      }
      
      lines.push('');
    });
  }
  
  lines.push('');
  lines.push('SAMPLE DATA (First 10 rows)');
  lines.push('-'.repeat(50));
  
  const sampleData = data.slice(0, 10);
  sampleData.forEach((row, index) => {
    lines.push(`Record ${index + 1}:`);
    Object.entries(row).forEach(([key, value]) => {
      lines.push(`  ${key}: ${value}`);
    });
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Validate export request
 */
async function validateExportRequest(request: DataExportRequest): Promise<void> {
  // Check if project exists
  const project = await db.queryRow<{ id: number }>`
    SELECT id FROM projects WHERE id = ${request.project_id}
  `;
  
  if (!project) {
    throw new Error('Project not found');
  }

  // Validate dashboard if specified
  if (request.dashboard_id) {
    const dashboard = await db.queryRow<{ id: number }>`
      SELECT id FROM custom_dashboards 
      WHERE id = ${request.dashboard_id} AND project_id = ${request.project_id}
    `;
    
    if (!dashboard) {
      throw new Error('Dashboard not found or access denied');
    }
  }

  // Validate custom query if provided
  if (request.data_source === 'custom_query') {
    if (!request.custom_query) {
      throw new Error('Custom query is required for custom_query data source');
    }
    
    // Basic SQL injection prevention (in production, use proper query validation)
    const suspiciousPatterns = [
      /\b(DROP|DELETE|UPDATE|INSERT)\b/i,
      /\b(ALTER|CREATE)\b/i,
      /--/,
      /;.*$/
    ];
    
    const hasSuspiciousPattern = suspiciousPatterns.some(pattern => 
      pattern.test(request.custom_query!)
    );
    
    if (hasSuspiciousPattern) {
      throw new Error('Custom query contains potentially unsafe operations');
    }
  }

  // Validate export size limits
  if (request.time_range) {
    const startDate = new Date(request.time_range.start);
    const endDate = new Date(request.time_range.end);
    const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysDiff > 365) {
      throw new Error('Export time range cannot exceed 365 days');
    }
  }
}

/**
 * API endpoint for cron job to clean up expired exports
 */
export const cleanupExpiredExportsEndpoint = api(
  { method: "POST", expose: false, path: "/internal/exports/cleanup" },
  async (): Promise<void> => {
    try {
      const expiredExports = await db.queryAll<{ id: number; file_url: string }>`
        SELECT id, file_url FROM dashboard_exports
        WHERE expires_at < NOW() 
        AND status = 'completed'
        AND file_url IS NOT NULL
      `;

      for (const exportRecord of expiredExports) {
        // In a real system, you'd delete the file from cloud storage
        console.log(`Would delete expired export file: ${exportRecord.file_url}`);
        
        // Mark as expired in database
        await db.exec`
          UPDATE dashboard_exports
          SET file_url = NULL, status = 'expired'
          WHERE id = ${exportRecord.id}
        `;
      }

      if (expiredExports.length > 0) {
        console.log(`Cleaned up ${expiredExports.length} expired export files`);
      }

    } catch (error) {
      console.error("Export cleanup job failed:", error);
    }
  }
);

/**
 * Background job to clean up expired exports
 */
export const exportCleanupJob = new CronJob("export-cleanup", {
  title: "Export File Cleanup",
  every: "1h", // Run every hour
  endpoint: cleanupExpiredExportsEndpoint,
});

/**
 * Get export statistics
 */
export const getExportStatistics = api<{
  project_id: number;
  days?: number;
}, {
  total_exports: number;
  successful_exports: number;
  failed_exports: number;
  total_size_bytes: number;
  by_type: Record<string, number>;
  by_user: Array<{ user: string; count: number }>;
}>(
  { expose: true, method: "GET", path: "/api/business-intelligence/exports/stats/:project_id" },
  async (params) => {
    const days = params.days || 30;
    const timeCondition = `WHERE project_id = $1 AND created_at >= NOW() - INTERVAL '${days} days'`;

    const [
      totalResult,
      successResult,
      failedResult,
      sizeResult,
      byTypeResults,
      byUserResults
    ] = await Promise.all([
      db.rawQueryRow<{ count: number }>(
        `SELECT COUNT(*) as count FROM dashboard_exports ${timeCondition}`,
        params.project_id
      ),
      db.rawQueryRow<{ count: number }>(
        `SELECT COUNT(*) as count FROM dashboard_exports ${timeCondition} AND status = 'completed'`,
        params.project_id
      ),
      db.rawQueryRow<{ count: number }>(
        `SELECT COUNT(*) as count FROM dashboard_exports ${timeCondition} AND status = 'failed'`,
        params.project_id
      ),
      db.rawQueryRow<{ total_size: number }>(
        `SELECT COALESCE(SUM(file_size), 0) as total_size FROM dashboard_exports ${timeCondition} AND file_size IS NOT NULL`,
        params.project_id
      ),
      db.rawQueryAll<{ export_type: string; count: number }>(
        `SELECT export_type, COUNT(*) as count FROM dashboard_exports ${timeCondition} GROUP BY export_type`,
        params.project_id
      ),
      db.rawQueryAll<{ created_by: string; count: number }>(
        `SELECT created_by, COUNT(*) as count FROM dashboard_exports ${timeCondition} GROUP BY created_by ORDER BY count DESC LIMIT 10`,
        params.project_id
      )
    ]);

    const byType: Record<string, number> = {};
    byTypeResults.forEach(r => { byType[r.export_type] = r.count; });

    const byUser = byUserResults.map(r => ({ user: r.created_by, count: r.count }));

    return {
      total_exports: totalResult?.count || 0,
      successful_exports: successResult?.count || 0,
      failed_exports: failedResult?.count || 0,
      total_size_bytes: sizeResult?.total_size || 0,
      by_type: byType,
      by_user: byUser
    };
  }
);