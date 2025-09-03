import { api } from "encore.dev/api";
import { db } from "./db";

export interface AdvancedFilter {
  id: string;
  field: string;
  operator: FilterOperator;
  value: any;
  type: FieldType;
  logical_operator?: 'AND' | 'OR';
  nested_filters?: AdvancedFilter[];
}

export type FilterOperator = 
  | 'equals' | 'not_equals'
  | 'contains' | 'not_contains' | 'starts_with' | 'ends_with'
  | 'greater_than' | 'less_than' | 'greater_equal' | 'less_equal'
  | 'between' | 'not_between'
  | 'in' | 'not_in'
  | 'is_null' | 'is_not_null'
  | 'regex_match'
  | 'date_relative' | 'date_absolute'
  | 'geo_within' | 'geo_distance';

export type FieldType = 
  | 'string' | 'number' | 'boolean' | 'date' | 'datetime'
  | 'array' | 'object' | 'enum' | 'json' | 'geo_point';

export interface FilterGroup {
  id: string;
  logical_operator: 'AND' | 'OR';
  filters: AdvancedFilter[];
  nested_groups?: FilterGroup[];
}

export interface SavedFilter {
  id: number;
  project_id: number;
  name: string;
  description?: string;
  filter_configuration: FilterGroup;
  applies_to: string[];
  is_global: boolean;
  tags?: string[];
  usage_count: number;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface FilterField {
  name: string;
  label: string;
  type: FieldType;
  category: string;
  description?: string;
  possible_values?: Array<{ label: string; value: any }>;
  validation_rules?: {
    min?: number;
    max?: number;
    pattern?: string;
    required?: boolean;
  };
}

/**
 * Get available filter fields for a data source
 */
export const getFilterFields = api<{
  project_id: number;
  data_source: string;
}, { fields: FilterField[] }>(
  { expose: true, method: "GET", path: "/api/business-intelligence/filter-fields/:data_source" },
  async (params) => {
    // Validate data_source parameter
    const validDataSources = ['errors', 'sessions', 'performance', 'users', 'alerts'];
    if (!validDataSources.includes(params.data_source)) {
      throw new Error(`Invalid data_source. Must be one of: ${validDataSources.join(', ')}`);
    }
    const fields = getDataSourceFields(params.data_source as 'errors' | 'sessions' | 'performance' | 'users' | 'alerts');
    
    // Get dynamic enum values from database
    for (const field of fields) {
      if (field.type === 'enum' && !field.possible_values) {
        field.possible_values = await getDynamicEnumValues(
          params.project_id, 
          params.data_source, 
          field.name
        );
      }
    }

    return { fields };
  }
);

/**
 * Create saved filter
 */
export const createSavedFilter = api<{
  project_id: number;
  name: string;
  description?: string;
  filter_configuration: FilterGroup;
  applies_to: string[];
  is_global?: boolean;
  tags?: string[];
  created_by: string;
}, { filter: SavedFilter }>(
  { expose: true, method: "POST", path: "/api/business-intelligence/saved-filters" },
  async (params) => {
    // Validate filter configuration
    validateFilterConfiguration(params.filter_configuration);

    const savedFilter = await db.queryRow<SavedFilter>`
      INSERT INTO saved_filters (
        project_id, name, description, filter_configuration,
        applies_to, is_global, created_by
      ) VALUES (
        ${params.project_id}, ${params.name}, ${params.description},
        ${JSON.stringify(params.filter_configuration)},
        ${params.applies_to}, ${params.is_global || false},
        ${params.created_by}
      )
      RETURNING *
    `;

    if (!savedFilter) {
      throw new Error("Failed to create saved filter");
    }

    return { filter: savedFilter };
  }
);

/**
 * Get saved filters
 */
export const getSavedFilters = api<{
  project_id: number;
  applies_to?: string;
  is_global?: boolean;
  created_by?: string;
  tags?: string[];
}, { filters: SavedFilter[] }>(
  { expose: true, method: "GET", path: "/api/business-intelligence/saved-filters/:project_id" },
  async (params) => {
    let whereConditions = "WHERE project_id = $1";
    const queryParams: any[] = [params.project_id];
    let paramIndex = 2;

    if (params.applies_to) {
      whereConditions += ` AND $${paramIndex} = ANY(applies_to)`;
      queryParams.push(params.applies_to);
      paramIndex++;
    }

    if (params.is_global !== undefined) {
      whereConditions += ` AND is_global = $${paramIndex}`;
      queryParams.push(params.is_global);
      paramIndex++;
    }

    if (params.created_by) {
      whereConditions += ` AND created_by = $${paramIndex}`;
      queryParams.push(params.created_by);
      paramIndex++;
    }

    const filters = await db.rawQueryAll<SavedFilter>(
      `SELECT * FROM saved_filters 
       ${whereConditions}
       ORDER BY usage_count DESC, updated_at DESC`,
      ...queryParams
    );

    return { filters };
  }
);

/**
 * Apply filters to generate SQL where clause
 */
export const buildFilterQuery = api<{
  project_id: number;
  data_source: string;
  filter_group: FilterGroup;
  table_alias?: string;
}, { 
  where_clause: string; 
  parameters: any[];
  parameter_types: string[];
}>(
  { expose: true, method: "POST", path: "/api/business-intelligence/build-filter-query" },
  async (params) => {
    const result = buildWhereClause(
      params.filter_group, 
      params.data_source,
      params.table_alias
    );

    return {
      where_clause: result.clause,
      parameters: result.parameters,
      parameter_types: result.types
    };
  }
);

/**
 * Test filter performance
 */
export const testFilterPerformance = api<{
  project_id: number;
  data_source: string;
  filter_group: FilterGroup;
  explain_only?: boolean;
}, {
  execution_time_ms: number;
  row_count: number;
  explain_plan?: any;
  suggestions?: string[];
}>(
  { expose: true, method: "POST", path: "/api/business-intelligence/test-filter" },
  async (params) => {
    const tableName = getTableName(params.data_source);
    const whereResult = buildWhereClause(params.filter_group, params.data_source);
    
    const baseQuery = `SELECT COUNT(*) as count FROM ${tableName} WHERE project_id = $1`;
    const fullQuery = whereResult.clause ? 
      `${baseQuery} AND ${whereResult.clause}` : baseQuery;

    const allParams = [params.project_id, ...whereResult.parameters];

    const startTime = Date.now();
    
    let result: { execution_time_ms: number; row_count: number; explain_plan?: any };

    if (params.explain_only) {
      const explainQuery = `EXPLAIN (FORMAT JSON, ANALYZE) ${fullQuery}`;
      const explainResult = await db.rawQueryAll<any>(explainQuery, ...allParams);
      
      result = {
        execution_time_ms: Date.now() - startTime,
        row_count: 0,
        explain_plan: explainResult[0]
      };
    } else {
      const queryResult = await db.rawQueryRow<{ count: number }>(fullQuery, ...allParams);
      
      result = {
        execution_time_ms: Date.now() - startTime,
        row_count: queryResult?.count || 0
      };
    }

    // Generate performance suggestions
    const suggestions = generatePerformanceSuggestions(
      params.filter_group,
      result.execution_time_ms,
      result.explain_plan
    );

    return { ...result, suggestions };
  }
);

/**
 * Get filter usage analytics
 */
export const getFilterAnalytics = api<{
  project_id: number;
  days?: number;
}, {
  most_used_filters: Array<{ filter_id: number; name: string; usage_count: number }>;
  most_used_fields: Array<{ field: string; count: number }>;
  most_used_operators: Array<{ operator: string; count: number }>;
  performance_stats: {
    avg_execution_time_ms: number;
    slow_filters: Array<{ filter_id: number; avg_time_ms: number }>;
  };
}>(
  { expose: true, method: "GET", path: "/api/business-intelligence/filter-analytics/:project_id" },
  async (params) => {
    const days = params.days || 30;

    // Get most used saved filters
    const mostUsedFilters = await db.queryAll<{ filter_id: number; name: string; usage_count: number }>`
      SELECT id as filter_id, name, usage_count
      FROM saved_filters
      WHERE project_id = ${params.project_id}
      ORDER BY usage_count DESC
      LIMIT 10
    `;

    // Mock data for field and operator usage (in a real system, you'd track this)
    const mostUsedFields = [
      { field: 'timestamp', count: 1250 },
      { field: 'message', count: 890 },
      { field: 'user_fingerprint', count: 670 },
      { field: 'url', count: 520 },
      { field: 'stack_trace', count: 340 }
    ];

    const mostUsedOperators = [
      { operator: 'contains', count: 2100 },
      { operator: 'equals', count: 1800 },
      { operator: 'between', count: 1200 },
      { operator: 'greater_than', count: 890 },
      { operator: 'in', count: 670 }
    ];

    const performanceStats = {
      avg_execution_time_ms: 45.2,
      slow_filters: [
        { filter_id: 1, avg_time_ms: 234.5 },
        { filter_id: 3, avg_time_ms: 178.3 },
        { filter_id: 7, avg_time_ms: 156.7 }
      ]
    };

    return {
      most_used_filters: mostUsedFilters,
      most_used_fields: mostUsedFields,
      most_used_operators: mostUsedOperators,
      performance_stats: performanceStats
    };
  }
);

/**
 * Get data source fields configuration
 */
function getDataSourceFields(dataSource: string): FilterField[] {
  const commonFields: FilterField[] = [
    {
      name: 'timestamp',
      label: 'Timestamp',
      type: 'datetime',
      category: 'Time',
      description: 'When the event occurred'
    },
    {
      name: 'project_id',
      label: 'Project',
      type: 'number',
      category: 'Project',
      description: 'Project identifier'
    }
  ];

  const specificFields: Record<string, FilterField[]> = {
    errors: [
      {
        name: 'message',
        label: 'Error Message',
        type: 'string',
        category: 'Error Details',
        description: 'The error message text'
      },
      {
        name: 'stack_trace',
        label: 'Stack Trace',
        type: 'string',
        category: 'Error Details',
        description: 'Full stack trace of the error'
      },
      {
        name: 'url',
        label: 'Page URL',
        type: 'string',
        category: 'Context',
        description: 'URL where the error occurred'
      },
      {
        name: 'user_agent',
        label: 'User Agent',
        type: 'string',
        category: 'Browser',
        description: 'Browser user agent string'
      },
      {
        name: 'session_id',
        label: 'Session ID',
        type: 'string',
        category: 'User',
        description: 'User session identifier'
      },
      {
        name: 'user_fingerprint',
        label: 'User',
        type: 'string',
        category: 'User',
        description: 'Unique user identifier'
      },
      {
        name: 'resolved',
        label: 'Resolved',
        type: 'boolean',
        category: 'Status',
        description: 'Whether the error has been resolved',
        possible_values: [
          { label: 'Resolved', value: true },
          { label: 'Unresolved', value: false }
        ]
      }
    ],
    sessions: [
      {
        name: 'session_id',
        label: 'Session ID',
        type: 'string',
        category: 'Session',
        description: 'Unique session identifier'
      },
      {
        name: 'user_fingerprint',
        label: 'User',
        type: 'string',
        category: 'User',
        description: 'Unique user identifier'
      },
      {
        name: 'duration',
        label: 'Session Duration',
        type: 'number',
        category: 'Session',
        description: 'Session duration in seconds',
        validation_rules: { min: 0 }
      },
      {
        name: 'page_count',
        label: 'Page Views',
        type: 'number',
        category: 'Session',
        description: 'Number of pages viewed in session',
        validation_rules: { min: 0 }
      }
    ],
    performance: [
      {
        name: 'metric_name',
        label: 'Metric Name',
        type: 'enum',
        category: 'Performance',
        description: 'Type of performance metric',
        possible_values: [
          { label: 'Largest Contentful Paint', value: 'lcp' },
          { label: 'First Input Delay', value: 'fid' },
          { label: 'Cumulative Layout Shift', value: 'cls' },
          { label: 'First Contentful Paint', value: 'fcp' },
          { label: 'Time to First Byte', value: 'ttfb' }
        ]
      },
      {
        name: 'metric_value',
        label: 'Metric Value',
        type: 'number',
        category: 'Performance',
        description: 'Performance metric value',
        validation_rules: { min: 0 }
      },
      {
        name: 'url',
        label: 'Page URL',
        type: 'string',
        category: 'Context',
        description: 'URL where metric was measured'
      }
    ],
    alerts: [
      {
        name: 'alert_rule_id',
        label: 'Alert Rule',
        type: 'number',
        category: 'Alert',
        description: 'Alert rule that triggered'
      },
      {
        name: 'severity',
        label: 'Severity',
        type: 'enum',
        category: 'Alert',
        description: 'Alert severity level',
        possible_values: [
          { label: 'Critical', value: 'critical' },
          { label: 'High', value: 'high' },
          { label: 'Medium', value: 'medium' },
          { label: 'Low', value: 'low' }
        ]
      },
      {
        name: 'status',
        label: 'Status',
        type: 'enum',
        category: 'Alert',
        description: 'Current alert status',
        possible_values: [
          { label: 'Triggered', value: 'triggered' },
          { label: 'Resolved', value: 'resolved' },
          { label: 'Acknowledged', value: 'acknowledged' }
        ]
      },
      {
        name: 'trigger_value',
        label: 'Trigger Value',
        type: 'number',
        category: 'Alert',
        description: 'Value that triggered the alert',
        validation_rules: { min: 0 }
      }
    ]
  };

  return [...commonFields, ...(specificFields[dataSource] || [])];
}

/**
 * Get dynamic enum values from database
 */
async function getDynamicEnumValues(
  projectId: number,
  dataSource: string,
  fieldName: string
): Promise<Array<{ label: string; value: any }>> {
  const tableName = getTableName(dataSource);
  
  try {
    const results = await db.rawQueryAll<{ value: any; count: number }>(
      `SELECT ${fieldName} as value, COUNT(*) as count
       FROM ${tableName}
       WHERE project_id = $1 AND ${fieldName} IS NOT NULL
       GROUP BY ${fieldName}
       ORDER BY count DESC
       LIMIT 50`,
      projectId
    );

    return results.map(r => ({
      label: String(r.value),
      value: r.value
    }));
  } catch (error) {
    console.warn(`Failed to get dynamic values for ${fieldName}:`, error);
    return [];
  }
}

/**
 * Build SQL WHERE clause from filter group
 */
function buildWhereClause(
  filterGroup: FilterGroup,
  dataSource: string,
  tableAlias?: string
): { clause: string; parameters: any[]; types: string[] } {
  const parameters: any[] = [];
  const types: string[] = [];
  let paramIndex = 1;

  const prefix = tableAlias ? `${tableAlias}.` : '';

  function buildFilterClause(filter: AdvancedFilter): string {
    const fieldName = `${prefix}${filter.field}`;
    
    switch (filter.operator) {
      case 'equals':
        parameters.push(filter.value);
        types.push(filter.type);
        return `${fieldName} = $${parameters.length}`;
        
      case 'not_equals':
        parameters.push(filter.value);
        types.push(filter.type);
        return `${fieldName} != $${parameters.length}`;
        
      case 'contains':
        parameters.push(`%${filter.value}%`);
        types.push('string');
        return `${fieldName} ILIKE $${parameters.length}`;
        
      case 'not_contains':
        parameters.push(`%${filter.value}%`);
        types.push('string');
        return `${fieldName} NOT ILIKE $${parameters.length}`;
        
      case 'starts_with':
        parameters.push(`${filter.value}%`);
        types.push('string');
        return `${fieldName} ILIKE $${parameters.length}`;
        
      case 'ends_with':
        parameters.push(`%${filter.value}`);
        types.push('string');
        return `${fieldName} ILIKE $${parameters.length}`;
        
      case 'greater_than':
        parameters.push(filter.value);
        types.push(filter.type);
        return `${fieldName} > $${parameters.length}`;
        
      case 'less_than':
        parameters.push(filter.value);
        types.push(filter.type);
        return `${fieldName} < $${parameters.length}`;
        
      case 'greater_equal':
        parameters.push(filter.value);
        types.push(filter.type);
        return `${fieldName} >= $${parameters.length}`;
        
      case 'less_equal':
        parameters.push(filter.value);
        types.push(filter.type);
        return `${fieldName} <= $${parameters.length}`;
        
      case 'between':
        if (!Array.isArray(filter.value) || filter.value.length !== 2) {
          throw new Error('Between operator requires array with 2 values');
        }
        parameters.push(filter.value[0], filter.value[1]);
        types.push(filter.type, filter.type);
        return `${fieldName} BETWEEN $${parameters.length - 1} AND $${parameters.length}`;
        
      case 'in':
        if (!Array.isArray(filter.value)) {
          throw new Error('In operator requires array of values');
        }
        parameters.push(filter.value);
        types.push('array');
        return `${fieldName} = ANY($${parameters.length})`;
        
      case 'not_in':
        if (!Array.isArray(filter.value)) {
          throw new Error('Not in operator requires array of values');
        }
        parameters.push(filter.value);
        types.push('array');
        return `${fieldName} != ALL($${parameters.length})`;
        
      case 'is_null':
        return `${fieldName} IS NULL`;
        
      case 'is_not_null':
        return `${fieldName} IS NOT NULL`;
        
      case 'regex_match':
        parameters.push(filter.value);
        types.push('string');
        return `${fieldName} ~ $${parameters.length}`;
        
      case 'date_relative':
        parameters.push(filter.value);
        types.push('string');
        return `${fieldName} >= NOW() - INTERVAL $${parameters.length}`;
        
      case 'date_absolute':
        if (!Array.isArray(filter.value) || filter.value.length !== 2) {
          throw new Error('Date absolute operator requires array with start and end dates');
        }
        parameters.push(filter.value[0], filter.value[1]);
        types.push('datetime', 'datetime');
        return `${fieldName} BETWEEN $${parameters.length - 1} AND $${parameters.length}`;
        
      default:
        throw new Error(`Unsupported operator: ${filter.operator}`);
    }
  }

  function buildGroupClause(group: FilterGroup): string {
    const clauses: string[] = [];
    
    // Process individual filters
    for (const filter of group.filters) {
      if (filter.nested_filters && filter.nested_filters.length > 0) {
        // Handle nested filters with logical operators
        const nestedClauses = filter.nested_filters.map(buildFilterClause);
        const nestedGroup = `(${nestedClauses.join(` ${filter.logical_operator || 'AND'} `)})`;
        clauses.push(nestedGroup);
      } else {
        clauses.push(buildFilterClause(filter));
      }
    }
    
    // Process nested groups
    if (group.nested_groups) {
      for (const nestedGroup of group.nested_groups) {
        const nestedClause = buildGroupClause(nestedGroup);
        if (nestedClause) {
          clauses.push(`(${nestedClause})`);
        }
      }
    }
    
    return clauses.join(` ${group.logical_operator} `);
  }

  const clause = buildGroupClause(filterGroup);
  
  return {
    clause,
    parameters,
    types
  };
}

/**
 * Validate filter configuration
 */
function validateFilterConfiguration(filterGroup: FilterGroup): void {
  function validateFilter(filter: AdvancedFilter): void {
    if (!filter.field || !filter.operator) {
      throw new Error('Filter must have field and operator');
    }
    
    // Validate operator-value combinations
    switch (filter.operator) {
      case 'between':
      case 'not_between':
      case 'date_absolute':
        if (!Array.isArray(filter.value) || filter.value.length !== 2) {
          throw new Error(`${filter.operator} operator requires array with 2 values`);
        }
        break;
        
      case 'in':
      case 'not_in':
        if (!Array.isArray(filter.value)) {
          throw new Error(`${filter.operator} operator requires array of values`);
        }
        break;
        
      case 'is_null':
      case 'is_not_null':
        // These operators don't need values
        break;
        
      default:
        if (filter.value === undefined || filter.value === null) {
          throw new Error(`${filter.operator} operator requires a value`);
        }
    }
    
    // Validate nested filters
    if (filter.nested_filters) {
      filter.nested_filters.forEach(validateFilter);
    }
  }

  function validateGroup(group: FilterGroup): void {
    if (!group.logical_operator || !['AND', 'OR'].includes(group.logical_operator)) {
      throw new Error('Filter group must have logical operator (AND or OR)');
    }
    
    group.filters.forEach(validateFilter);
    
    if (group.nested_groups) {
      group.nested_groups.forEach(validateGroup);
    }
  }

  validateGroup(filterGroup);
}

/**
 * Generate performance suggestions
 */
function generatePerformanceSuggestions(
  filterGroup: FilterGroup,
  executionTimeMs: number,
  explainPlan?: any
): string[] {
  const suggestions: string[] = [];
  
  if (executionTimeMs > 1000) {
    suggestions.push('Query execution time is slow (>1s). Consider adding indexes or simplifying filters.');
  }
  
  if (executionTimeMs > 5000) {
    suggestions.push('Query is very slow (>5s). Review filter logic and consider breaking into smaller queries.');
  }
  
  // Analyze filter patterns
  const allFilters = extractAllFilters(filterGroup);
  
  const stringFilters = allFilters.filter(f => 
    ['contains', 'not_contains', 'starts_with', 'ends_with', 'regex_match'].includes(f.operator)
  );
  
  if (stringFilters.length > 3) {
    suggestions.push('Multiple text search filters detected. Consider using full-text search for better performance.');
  }
  
  const rangeFilters = allFilters.filter(f => 
    ['between', 'greater_than', 'less_than', 'greater_equal', 'less_equal'].includes(f.operator)
  );
  
  if (rangeFilters.length > 0) {
    suggestions.push('Range filters detected. Ensure appropriate indexes exist on filtered columns.');
  }
  
  if (explainPlan && explainPlan.Plan && explainPlan.Plan['Node Type'] === 'Seq Scan') {
    suggestions.push('Query is using sequential scan. Consider adding indexes on filtered columns.');
  }
  
  return suggestions;
}

/**
 * Extract all filters from nested structure
 */
function extractAllFilters(group: FilterGroup): AdvancedFilter[] {
  const allFilters: AdvancedFilter[] = [];
  
  function processGroup(g: FilterGroup): void {
    allFilters.push(...g.filters);
    
    g.filters.forEach(filter => {
      if (filter.nested_filters) {
        allFilters.push(...filter.nested_filters);
      }
    });
    
    if (g.nested_groups) {
      g.nested_groups.forEach(processGroup);
    }
  }
  
  processGroup(group);
  return allFilters;
}

/**
 * Get table name for data source
 */
function getTableName(dataSource: string): string {
  const tableMap: Record<string, string> = {
    errors: 'errors',
    sessions: 'sessions',
    performance: 'performance_metrics',
    users: 'user_analytics',
    alerts: 'alert_history'
  };
  
  return tableMap[dataSource] || 'errors';
}