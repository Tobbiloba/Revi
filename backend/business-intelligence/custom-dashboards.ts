import { api } from "encore.dev/api";
import { db } from "./db";

export interface CustomDashboard {
  id: number;
  project_id: number;
  name: string;
  description?: string;
  layout: DashboardLayout;
  widgets: DashboardWidget[];
  filters: DashboardFilter[];
  permissions: DashboardPermission[];
  is_public: boolean;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface DashboardLayout {
  columns: number;
  rows: number;
  grid_size: number;
  responsive_breakpoints: Record<string, { columns: number; grid_size: number }>;
}

export interface DashboardWidget {
  id: string;
  type: 'chart' | 'metric' | 'table' | 'alert_summary' | 'error_timeline' | 'heatmap' | 'funnel' | 'custom';
  title: string;
  position: { x: number; y: number; width: number; height: number };
  configuration: WidgetConfiguration;
  data_source: DataSourceConfiguration;
  refresh_interval?: number; // seconds
  conditions?: WidgetCondition[];
}

export interface WidgetConfiguration {
  chart_type?: 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'gauge' | 'donut';
  time_range: { start: string; end: string; relative?: string };
  grouping?: { field: string; interval?: string };
  aggregation?: { field: string; function: 'count' | 'sum' | 'avg' | 'max' | 'min' };
  display_options: {
    show_legend?: boolean;
    show_grid?: boolean;
    colors?: string[];
    format?: string;
    precision?: number;
  };
  thresholds?: Array<{ value: number; color: string; condition: 'above' | 'below' }>;
}

export interface DataSourceConfiguration {
  type: 'errors' | 'sessions' | 'performance' | 'users' | 'custom_query';
  query?: string;
  filters?: Record<string, any>;
  joins?: Array<{ table: string; on: string; type: 'inner' | 'left' | 'right' }>;
}

export interface DashboardFilter {
  id: string;
  name: string;
  type: 'date_range' | 'dropdown' | 'multi_select' | 'text' | 'number_range';
  field: string;
  default_value?: any;
  options?: Array<{ label: string; value: any }>;
  applies_to_widgets: string[]; // Widget IDs
}

export interface DashboardPermission {
  user_id?: string;
  role?: string;
  permissions: Array<'view' | 'edit' | 'delete' | 'share'>;
}

export interface WidgetCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'between';
  value: any;
}

/**
 * Create custom dashboard with simplified input
 */
export const createCustomDashboard = api<{
  project_id: number;
  name: string;
  description?: string;
  layout?: DashboardLayout;
  widgets?: DashboardWidget[];
  filters?: DashboardFilter[];
  permissions?: DashboardPermission[];
  is_public?: boolean;
  created_by?: string;
}, { dashboard: CustomDashboard }>(
  { expose: true, method: "POST", path: "/api/business-intelligence/dashboards" },
  async (params) => {
    // Provide default layout if not specified
    const defaultLayout: DashboardLayout = {
      columns: 12,
      rows: 8,
      grid_size: 50,
      responsive_breakpoints: {
        lg: { columns: 12, grid_size: 50 },
        md: { columns: 8, grid_size: 40 },
        sm: { columns: 6, grid_size: 30 }
      }
    };

    // Provide default widgets if not specified
    const defaultWidgets: DashboardWidget[] = [
      {
        id: "default-errors",
        type: "chart",
        title: "Error Count",
        position: { x: 0, y: 0, width: 6, height: 4 },
        configuration: {
          chart_type: "line",
          time_range: { start: "24h", end: "now" },
          aggregation: { field: "count", function: "count" },
          display_options: { show_legend: true, show_grid: true }
        },
        data_source: {
          type: "errors",
          filters: {}
        }
      }
    ];

    const dashboard = await db.queryRow<CustomDashboard>`
      INSERT INTO custom_dashboards (
        project_id, name, description, layout, widgets, 
        filters, permissions, is_public, created_by
      ) VALUES (
        ${params.project_id}, ${params.name}, ${params.description || ''},
        ${JSON.stringify(params.layout || defaultLayout)}, 
        ${JSON.stringify(params.widgets || defaultWidgets)},
        ${JSON.stringify(params.filters || [])}, 
        ${JSON.stringify(params.permissions || [])},
        ${params.is_public || false}, ${params.created_by || 'system'}
      )
      RETURNING *
    `;

    if (!dashboard) {
      throw new Error("Failed to create custom dashboard");
    }

    return { dashboard };
  }
);

/**
 * Get dashboards for project
 */
export const getCustomDashboards = api<{
  project_id: number;
  user_id?: string;
  include_public?: boolean;
}, { dashboards: CustomDashboard[] }>(
  { expose: true, method: "GET", path: "/api/business-intelligence/dashboards/by-project/:project_id" },
  async (params) => {
    let whereConditions = "WHERE project_id = $1";
    const queryParams: any[] = [params.project_id];
    let paramIndex = 2;

    if (!params.include_public) {
      whereConditions += ` AND (created_by = $${paramIndex} OR is_public = true)`;
      queryParams.push(params.user_id);
      paramIndex++;
    }

    const dashboards = await db.rawQueryAll<CustomDashboard>(
      `SELECT * FROM custom_dashboards 
       ${whereConditions}
       ORDER BY updated_at DESC`,
      ...queryParams
    );

    return { dashboards };
  }
);

/**
 * Get dashboard by ID with data
 */
export const getDashboardWithData = api<{
  dashboard_id: number;
  time_range?: { start: string; end: string };
  filters?: Record<string, any>;
}, { 
  dashboard: CustomDashboard; 
  widget_data: Record<string, any>;
}>(
  { expose: true, method: "GET", path: "/api/business-intelligence/dashboards/:dashboard_id/data" },
  async (params) => {
    const dashboard = await db.queryRow<CustomDashboard>`
      SELECT * FROM custom_dashboards WHERE id = ${params.dashboard_id}
    `;

    if (!dashboard) {
      throw new Error("Dashboard not found");
    }

    const widgetData: Record<string, any> = {};

    // Execute queries for each widget
    for (const widget of dashboard.widgets) {
      try {
        const data = await executeWidgetQuery(widget, params.time_range, params.filters);
        widgetData[widget.id] = data;
      } catch (error) {
        console.error(`Error executing query for widget ${widget.id}:`, error);
        widgetData[widget.id] = { error: 'Failed to load data' };
      }
    }

    return { 
      dashboard,
      widget_data: widgetData
    };
  }
);

/**
 * Execute widget query and return data
 */
async function executeWidgetQuery(
  widget: DashboardWidget,
  timeRange?: { start: string; end: string },
  filters?: Record<string, any>
): Promise<any> {
  const config = widget.configuration;
  const dataSource = widget.data_source;

  // Build time range condition
  const timeCondition = timeRange ? 
    `AND timestamp BETWEEN '${timeRange.start}' AND '${timeRange.end}'` :
    config.time_range?.relative ? 
      `AND timestamp >= NOW() - INTERVAL '${config.time_range.relative}'` :
      '';

  // Build filter conditions
  let filterConditions = '';
  const filterParams: any[] = [];
  let paramIndex = 1;

  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value != null && value !== '') {
        filterConditions += ` AND ${key} = $${paramIndex}`;
        filterParams.push(value);
        paramIndex++;
      }
    });
  }

  if (dataSource.filters) {
    Object.entries(dataSource.filters).forEach(([key, value]) => {
      if (value != null && value !== '') {
        filterConditions += ` AND ${key} = $${paramIndex}`;
        filterParams.push(value);
        paramIndex++;
      }
    });
  }

  switch (widget.type) {
    case 'metric':
      return await executeMetricQuery(dataSource, config, timeCondition, filterConditions, filterParams);
    
    case 'chart':
      return await executeChartQuery(dataSource, config, timeCondition, filterConditions, filterParams);
    
    case 'table':
      return await executeTableQuery(dataSource, config, timeCondition, filterConditions, filterParams);
    
    case 'alert_summary':
      return await executeAlertSummaryQuery(dataSource, timeCondition, filterConditions, filterParams);
    
    case 'error_timeline':
      return await executeErrorTimelineQuery(dataSource, config, timeCondition, filterConditions, filterParams);
    
    case 'heatmap':
      return await executeHeatmapQuery(dataSource, config, timeCondition, filterConditions, filterParams);
    
    case 'funnel':
      return await executeFunnelQuery(dataSource, config, timeCondition, filterConditions, filterParams);
    
    case 'custom':
      return await executeCustomQuery(dataSource, filterParams);
    
    default:
      throw new Error(`Unsupported widget type: ${widget.type}`);
  }
}

/**
 * Execute metric query (single value)
 */
async function executeMetricQuery(
  dataSource: DataSourceConfiguration,
  config: WidgetConfiguration,
  timeCondition: string,
  filterConditions: string,
  filterParams: any[]
): Promise<{ value: number; previous_value?: number; change?: number; format?: string }> {
  const table = getTableName(dataSource.type);
  const aggregateField = config.aggregation?.field || '*';
  const aggregateFunction = config.aggregation?.function || 'count';

  let query = '';
  if (aggregateFunction === 'count') {
    query = `SELECT COUNT(${aggregateField}) as value FROM ${table} WHERE 1=1 ${timeCondition} ${filterConditions}`;
  } else {
    query = `SELECT ${aggregateFunction.toUpperCase()}(${aggregateField}) as value FROM ${table} WHERE 1=1 ${timeCondition} ${filterConditions}`;
  }

  const result = await db.rawQueryRow<{ value: number }>(query, ...filterParams);
  
  // Calculate previous period for comparison
  let previousValue;
  if (config.time_range?.relative) {
    const previousTimeCondition = `AND timestamp >= NOW() - INTERVAL '${config.time_range.relative}' * 2 AND timestamp < NOW() - INTERVAL '${config.time_range.relative}'`;
    const previousQuery = query.replace(timeCondition, previousTimeCondition);
    
    const previousResult = await db.rawQueryRow<{ value: number }>(previousQuery, ...filterParams);
    previousValue = previousResult?.value || 0;
  }

  const value = result?.value || 0;
  const change = previousValue !== undefined ? 
    ((value - previousValue) / (previousValue || 1)) * 100 : undefined;

  return {
    value,
    previous_value: previousValue,
    change,
    format: config.display_options?.format
  };
}

/**
 * Execute chart query (time series or grouped data)
 */
async function executeChartQuery(
  dataSource: DataSourceConfiguration,
  config: WidgetConfiguration,
  timeCondition: string,
  filterConditions: string,
  filterParams: any[]
): Promise<{ labels: string[]; datasets: Array<{ label: string; data: number[]; backgroundColor?: string }> }> {
  const table = getTableName(dataSource.type);
  const groupField = config.grouping?.field || 'DATE_TRUNC(\'hour\', timestamp)';
  const aggregateField = config.aggregation?.field || '*';
  const aggregateFunction = config.aggregation?.function || 'count';

  let selectClause = '';
  if (aggregateFunction === 'count') {
    selectClause = `${groupField} as label, COUNT(${aggregateField}) as value`;
  } else {
    selectClause = `${groupField} as label, ${aggregateFunction.toUpperCase()}(${aggregateField}) as value`;
  }

  const query = `
    SELECT ${selectClause}
    FROM ${table} 
    WHERE 1=1 ${timeCondition} ${filterConditions}
    GROUP BY ${groupField}
    ORDER BY ${groupField}
    LIMIT 1000
  `;

  const results = await db.rawQueryAll<{ label: string; value: number }>(query, ...filterParams);

  const labels = results.map(r => r.label.toString());
  const data = results.map(r => r.value);

  return {
    labels,
    datasets: [{
      label: config.aggregation?.function || 'Count',
      data,
      backgroundColor: config.display_options?.colors?.[0]
    }]
  };
}

/**
 * Execute table query
 */
async function executeTableQuery(
  dataSource: DataSourceConfiguration,
  config: WidgetConfiguration,
  timeCondition: string,
  filterConditions: string,
  filterParams: any[]
): Promise<{ columns: string[]; rows: any[][] }> {
  const table = getTableName(dataSource.type);
  
  let query = `SELECT * FROM ${table} WHERE 1=1 ${timeCondition} ${filterConditions}`;
  
  if (config.grouping?.field) {
    const aggregateField = config.aggregation?.field || '*';
    const aggregateFunction = config.aggregation?.function || 'count';
    
    if (aggregateFunction === 'count') {
      query = `SELECT ${config.grouping.field}, COUNT(${aggregateField}) as count FROM ${table} WHERE 1=1 ${timeCondition} ${filterConditions} GROUP BY ${config.grouping.field}`;
    } else {
      query = `SELECT ${config.grouping.field}, ${aggregateFunction.toUpperCase()}(${aggregateField}) as ${aggregateFunction}_value FROM ${table} WHERE 1=1 ${timeCondition} ${filterConditions} GROUP BY ${config.grouping.field}`;
    }
  }
  
  query += ' ORDER BY timestamp DESC LIMIT 100';

  const results = await db.rawQueryAll<Record<string, any>>(query, ...filterParams);

  if (results.length === 0) {
    return { columns: [], rows: [] };
  }

  const columns = Object.keys(results[0]);
  const rows = results.map(row => columns.map(col => row[col]));

  return { columns, rows };
}

/**
 * Execute alert summary query
 */
async function executeAlertSummaryQuery(
  dataSource: DataSourceConfiguration,
  timeCondition: string,
  filterConditions: string,
  filterParams: any[]
): Promise<{
  total_alerts: number;
  by_severity: Record<string, number>;
  by_status: Record<string, number>;
  recent_alerts: any[];
}> {
  const baseQuery = `FROM alert_history WHERE 1=1 ${timeCondition} ${filterConditions}`;
  
  const [totalResult, severityResults, statusResults, recentAlerts] = await Promise.all([
    db.rawQueryRow<{ count: number }>(`SELECT COUNT(*) as count ${baseQuery}`, ...filterParams),
    db.rawQueryAll<{ severity: string; count: number }>(`SELECT severity, COUNT(*) as count ${baseQuery} GROUP BY severity`, ...filterParams),
    db.rawQueryAll<{ status: string; count: number }>(`SELECT status, COUNT(*) as count ${baseQuery} GROUP BY status`, ...filterParams),
    db.rawQueryAll<any>(`SELECT * ${baseQuery} ORDER BY triggered_at DESC LIMIT 10`, ...filterParams)
  ]);

  const bySeverity: Record<string, number> = {};
  severityResults.forEach(r => { bySeverity[r.severity] = r.count; });

  const byStatus: Record<string, number> = {};
  statusResults.forEach(r => { byStatus[r.status] = r.count; });

  return {
    total_alerts: totalResult?.count || 0,
    by_severity: bySeverity,
    by_status: byStatus,
    recent_alerts: recentAlerts
  };
}

/**
 * Execute error timeline query
 */
async function executeErrorTimelineQuery(
  dataSource: DataSourceConfiguration,
  config: WidgetConfiguration,
  timeCondition: string,
  filterConditions: string,
  filterParams: any[]
): Promise<{ timeline: Array<{ time: string; count: number; severity?: string }> }> {
  const interval = config.grouping?.interval || '1 hour';
  
  const query = `
    SELECT 
      DATE_TRUNC('${interval}', timestamp) as time,
      COUNT(*) as count,
      CASE 
        WHEN COUNT(*) > 100 THEN 'high'
        WHEN COUNT(*) > 50 THEN 'medium'
        ELSE 'low'
      END as severity
    FROM errors 
    WHERE 1=1 ${timeCondition} ${filterConditions}
    GROUP BY DATE_TRUNC('${interval}', timestamp)
    ORDER BY time
    LIMIT 1000
  `;

  const results = await db.rawQueryAll<{ time: Date; count: number; severity: string }>(query, ...filterParams);

  return {
    timeline: results.map(r => ({
      time: r.time.toISOString(),
      count: r.count,
      severity: r.severity
    }))
  };
}

/**
 * Execute heatmap query
 */
async function executeHeatmapQuery(
  dataSource: DataSourceConfiguration,
  config: WidgetConfiguration,
  timeCondition: string,
  filterConditions: string,
  filterParams: any[]
): Promise<{ heatmap_data: Array<{ x: number; y: number; value: number }> }> {
  // This would typically join with session_events to get interaction data
  const query = `
    SELECT 
      EXTRACT(HOUR FROM timestamp) as x,
      EXTRACT(DOW FROM timestamp) as y,
      COUNT(*) as value
    FROM errors 
    WHERE 1=1 ${timeCondition} ${filterConditions}
    GROUP BY EXTRACT(HOUR FROM timestamp), EXTRACT(DOW FROM timestamp)
    ORDER BY x, y
  `;

  const results = await db.rawQueryAll<{ x: number; y: number; value: number }>(query, ...filterParams);

  return { heatmap_data: results };
}

/**
 * Execute funnel query
 */
async function executeFunnelQuery(
  dataSource: DataSourceConfiguration,
  config: WidgetConfiguration,
  timeCondition: string,
  filterConditions: string,
  filterParams: any[]
): Promise<{ funnel_steps: Array<{ step: string; count: number; conversion_rate?: number }> }> {
  // This is a simplified funnel - in practice, you'd define funnel steps in the widget config
  const steps = [
    { name: 'Sessions Started', query: 'SELECT COUNT(DISTINCT session_id) as count FROM sessions' },
    { name: 'Errors Encountered', query: 'SELECT COUNT(DISTINCT session_id) as count FROM errors' },
    { name: 'Errors Resolved', query: 'SELECT COUNT(DISTINCT session_id) as count FROM errors WHERE resolved = true' }
  ];

  const results = [];
  let previousCount = 0;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const fullQuery = `${step.query} WHERE 1=1 ${timeCondition} ${filterConditions}`;
    
    const result = await db.rawQueryRow<{ count: number }>(fullQuery, ...filterParams);
    const count = result?.count || 0;
    
    const conversionRate = i > 0 && previousCount > 0 ? (count / previousCount) * 100 : undefined;
    
    results.push({
      step: step.name,
      count,
      conversion_rate: conversionRate
    });
    
    previousCount = count;
  }

  return { funnel_steps: results };
}

/**
 * Execute custom query
 */
async function executeCustomQuery(
  dataSource: DataSourceConfiguration,
  filterParams: any[]
): Promise<any> {
  if (!dataSource.query) {
    throw new Error('Custom query not provided');
  }

  try {
    const results = await db.rawQueryAll<any>(dataSource.query, ...filterParams);
    return { results };
  } catch (error) {
    throw new Error(`Custom query failed: ${error}`);
  }
}

/**
 * Get table name for data source type
 */
function getTableName(type: string): string {
  switch (type) {
    case 'errors':
      return 'errors';
    case 'sessions':
      return 'sessions';
    case 'performance':
      return 'performance_metrics';
    case 'users':
      return 'users';
    default:
      return 'errors'; // fallback
  }
}

/**
 * Update dashboard
 */
export const updateCustomDashboard = api<{
  dashboard_id: number;
  name?: string;
  description?: string;
  layout?: DashboardLayout;
  widgets?: DashboardWidget[];
  filters?: DashboardFilter[];
  permissions?: DashboardPermission[];
  is_public?: boolean;
}, { success: boolean }>(
  { expose: true, method: "PATCH", path: "/api/business-intelligence/dashboards/:dashboard_id" },
  async (params) => {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (params.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(params.name);
    }

    if (params.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(params.description);
    }

    if (params.layout !== undefined) {
      updates.push(`layout = $${paramIndex++}`);
      values.push(JSON.stringify(params.layout));
    }

    if (params.widgets !== undefined) {
      updates.push(`widgets = $${paramIndex++}`);
      values.push(JSON.stringify(params.widgets));
    }

    if (params.filters !== undefined) {
      updates.push(`filters = $${paramIndex++}`);
      values.push(JSON.stringify(params.filters));
    }

    if (params.permissions !== undefined) {
      updates.push(`permissions = $${paramIndex++}`);
      values.push(JSON.stringify(params.permissions));
    }

    if (params.is_public !== undefined) {
      updates.push(`is_public = $${paramIndex++}`);
      values.push(params.is_public);
    }

    if (updates.length === 0) {
      return { success: false };
    }

    updates.push(`updated_at = NOW()`);

    await db.rawExec(
      `UPDATE custom_dashboards SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      ...values, params.dashboard_id
    );

    return { success: true };
  }
);

/**
 * Delete dashboard
 */
export const deleteCustomDashboard = api<{
  dashboard_id: number;
}, { success: boolean }>(
  { expose: true, method: "DELETE", path: "/api/business-intelligence/dashboards/:dashboard_id" },
  async (params) => {
    await db.exec`
      DELETE FROM custom_dashboards WHERE id = ${params.dashboard_id}
    `;

    return { success: true };
  }
);

/**
 * Clone dashboard
 */
export const cloneCustomDashboard = api<{
  dashboard_id: number;
  name: string;
  created_by: string;
}, { dashboard: CustomDashboard }>(
  { expose: true, method: "POST", path: "/api/business-intelligence/dashboards/:dashboard_id/clone" },
  async (params) => {
    const original = await db.queryRow<CustomDashboard>`
      SELECT * FROM custom_dashboards WHERE id = ${params.dashboard_id}
    `;

    if (!original) {
      throw new Error("Dashboard not found");
    }

    const cloned = await db.queryRow<CustomDashboard>`
      INSERT INTO custom_dashboards (
        project_id, name, description, layout, widgets, 
        filters, permissions, is_public, created_by
      ) VALUES (
        ${original.project_id}, ${params.name}, 
        'Cloned from: ' || ${original.name},
        ${JSON.stringify(original.layout)}, ${JSON.stringify(original.widgets)},
        ${JSON.stringify(original.filters)}, ${JSON.stringify(original.permissions)},
        false, ${params.created_by}
      )
      RETURNING *
    `;

    if (!cloned) {
      throw new Error("Failed to clone dashboard");
    }

    return { dashboard: cloned };
  }
);