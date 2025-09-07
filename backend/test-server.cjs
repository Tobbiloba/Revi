const express = require('express');
const cors = require('cors');
const { Client } = require('pg');
const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:3001"], // Allow dashboard connections
    methods: ["GET", "POST"]
  }
});
const port = 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const db = new Client({
  host: 'localhost',
  database: 'revi_test',
  user: process.env.USER || 'postgres',
  password: process.env.PGPASSWORD || '',
  port: 5432,
});

// Connect to database
db.connect().then(() => {
  console.log('Connected to PostgreSQL database');
}).catch(err => {
  console.error('Database connection error:', err);
});

// WebSocket connection management
const connectedClients = new Map(); // projectId -> Set of socket IDs
const clientProjects = new Map();   // socket ID -> projectId

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Handle project subscription
  socket.on('subscribe:project', (projectId) => {
    console.log(`Client ${socket.id} subscribing to project ${projectId}`);
    
    // Leave any previous project room
    if (clientProjects.has(socket.id)) {
      const oldProjectId = clientProjects.get(socket.id);
      socket.leave(`project:${oldProjectId}`);
      
      if (connectedClients.has(oldProjectId)) {
        connectedClients.get(oldProjectId).delete(socket.id);
        if (connectedClients.get(oldProjectId).size === 0) {
          connectedClients.delete(oldProjectId);
        }
      }
    }
    
    // Join new project room
    socket.join(`project:${projectId}`);
    clientProjects.set(socket.id, projectId);
    
    if (!connectedClients.has(projectId)) {
      connectedClients.set(projectId, new Set());
    }
    connectedClients.get(projectId).add(socket.id);
    
    // Send initial batch of recent errors
    sendRecentErrors(socket, projectId);
  });
  
  // Handle unsubscribe
  socket.on('unsubscribe:project', (projectId) => {
    console.log(`Client ${socket.id} unsubscribing from project ${projectId}`);
    socket.leave(`project:${projectId}`);
    
    if (connectedClients.has(projectId)) {
      connectedClients.get(projectId).delete(socket.id);
      if (connectedClients.get(projectId).size === 0) {
        connectedClients.delete(projectId);
      }
    }
    
    if (clientProjects.has(socket.id) && clientProjects.get(socket.id) === projectId) {
      clientProjects.delete(socket.id);
    }
  });
  
  // Handle filter updates
  socket.on('filters:update', (filters) => {
    console.log(`Client ${socket.id} updated filters:`, filters);
    socket.filters = filters;
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    if (clientProjects.has(socket.id)) {
      const projectId = clientProjects.get(socket.id);
      
      if (connectedClients.has(projectId)) {
        connectedClients.get(projectId).delete(socket.id);
        if (connectedClients.get(projectId).size === 0) {
          connectedClients.delete(projectId);
        }
      }
      
      clientProjects.delete(socket.id);
    }
  });
});

// Send recent errors to newly connected client
async function sendRecentErrors(socket, projectId) {
  try {
    const result = await db.query(`
      SELECT e.*, p.name as project_name
      FROM errors e
      JOIN projects p ON e.project_id = p.id
      WHERE e.project_id = $1
      ORDER BY e.timestamp DESC
      LIMIT 50
    `, [projectId]);
    
    if (result.rows.length > 0) {
      const errors = result.rows.map(row => ({
        id: row.id,
        message: row.message,
        stack_trace: row.stack_trace,
        url: row.url,
        user_agent: row.user_agent,
        session_id: row.session_id,
        timestamp: row.timestamp,
        project_id: row.project_id,
        metadata: row.metadata,
        severity: determineSeverity(row.message, row.stack_trace),
        isNew: false
      }));
      
      socket.emit('errors:batch', errors);
    }
  } catch (error) {
    console.error('Failed to send recent errors:', error);
  }
}

// Determine error severity based on message and stack trace
function determineSeverity(message, stackTrace) {
  if (!message) return 'medium';
  
  const messageStr = message.toLowerCase();
  const stackStr = (stackTrace || '').toLowerCase();
  
  // Critical indicators
  if (messageStr.includes('uncaught') || 
      messageStr.includes('fatal') || 
      messageStr.includes('crash') ||
      messageStr.includes('out of memory') ||
      stackStr.includes('uncaught')) {
    return 'critical';
  }
  
  // High severity indicators  
  if (messageStr.includes('error') || 
      messageStr.includes('exception') ||
      messageStr.includes('failed') ||
      stackStr.includes('error')) {
    return 'high';
  }
  
  // Low severity indicators
  if (messageStr.includes('warning') || 
      messageStr.includes('deprecated') ||
      messageStr.includes('notice')) {
    return 'low';
  }
  
  return 'medium';
}

// Emit real-time error to connected clients
function emitErrorToClients(projectId, errorData) {
  if (connectedClients.has(projectId)) {
    io.to(`project:${projectId}`).emit('error:new', {
      ...errorData,
      isNew: true,
      severity: determineSeverity(errorData.message, errorData.stack_trace)
    });
    console.log(`Emitted error to ${connectedClients.get(projectId).size} clients for project ${projectId}`);
  }
}

// Update session tracking for user journey reconstruction
async function updateSessionTracking(projectId, sessionId, url, timestamp) {
  try {
    // First, ensure session exists
    await db.query(`
      INSERT INTO sessions (project_id, session_id, user_id, started_at, ended_at, metadata)
      VALUES ($1, $2, NULL, $3, $3, '{}')
      ON CONFLICT (session_id) DO UPDATE SET
        ended_at = $3,
        metadata = sessions.metadata || '{"page_count": 1}'::jsonb
    `, [projectId, sessionId, timestamp]);
    
    // Add session event for navigation
    if (url) {
      await db.query(`
        INSERT INTO session_events (session_id, event_type, data, timestamp)
        VALUES ($1, 'navigation', $2, $3)
      `, [sessionId, JSON.stringify({ url, type: 'error_page' }), timestamp]);
    }
  } catch (error) {
    console.error('Failed to update session tracking:', error);
  }
}

// Helper function to validate API key
async function validateApiKey(apiKey) {
  if (!apiKey) {
    throw new Error('missing API key');
  }
  
  const result = await db.query('SELECT id FROM projects WHERE api_key = $1', [apiKey]);
  if (result.rows.length === 0) {
    throw new Error('invalid API key');
  }
  
  return result.rows[0].id;
}

// Error capture endpoint
app.post('/api/capture/error', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    const projectId = await validateApiKey(apiKey);
    
    const errorsToProcess = req.body.errors || [req.body];
    const errorIds = [];
    const capturedErrors = [];
    
    for (const errorData of errorsToProcess) {
      const result = await db.query(`
        INSERT INTO errors (
          project_id, message, stack_trace, url, user_agent, 
          session_id, metadata, timestamp
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING id, timestamp
      `, [
        projectId, 
        errorData.message, 
        errorData.stack_trace,
        errorData.url, 
        errorData.user_agent, 
        errorData.session_id,
        JSON.stringify(errorData.metadata || {})
      ]);
      
      if (result.rows.length > 0) {
        const errorId = result.rows[0].id;
        const timestamp = result.rows[0].timestamp;
        errorIds.push(errorId);
        
        // Prepare error data for real-time emission
        const realtimeError = {
          id: errorId,
          project_id: projectId,
          message: errorData.message,
          stack_trace: errorData.stack_trace,
          url: errorData.url,
          user_agent: errorData.user_agent,
          session_id: errorData.session_id,
          session_user_id: errorData.metadata?.userId || errorData.metadata?.user_id,
          metadata: errorData.metadata || {},
          timestamp: timestamp
        };
        
        capturedErrors.push(realtimeError);
        
        // Emit real-time error to connected clients
        emitErrorToClients(projectId, realtimeError);
      }
    }
    
    // Also update session tracking if session events exist
    for (const error of capturedErrors) {
      if (error.session_id) {
        await updateSessionTracking(projectId, error.session_id, error.url, error.timestamp);
      }
    }
    
    res.json({
      success: true,
      error_ids: errorIds
    });
  } catch (error) {
    console.error('Error capture failed:', error);
    res.status(error.message.includes('invalid API key') || error.message.includes('missing API key') ? 401 : 500)
       .json({ success: false, error: error.message });
  }
});

// Session event capture endpoint
app.post('/api/capture/session-event', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    const projectId = await validateApiKey(apiKey);
    
    const eventsToProcess = req.body.events || [{
      event_type: req.body.event_type,
      data: req.body.data,
      timestamp: req.body.timestamp || Date.now(),
      session_id: req.body.session_id
    }];
    
    const eventIds = [];
    
    // Get session_id from batch events or single event
    const sessionId = req.body.events ? 
      eventsToProcess[0].session_id : 
      req.body.session_id;
    
    // Ensure session exists
    await db.query(`
      INSERT INTO sessions (project_id, session_id, started_at, metadata)
      VALUES ($1, $2, NOW(), '{}')
      ON CONFLICT (project_id, session_id) DO NOTHING
    `, [projectId, sessionId]);
    
    for (const eventData of eventsToProcess) {
      const result = await db.query(`
        INSERT INTO session_events (session_id, event_type, data, timestamp)
        VALUES ($1, $2, $3, to_timestamp($4 / 1000.0))
        RETURNING id
      `, [
        eventData.session_id,
        eventData.event_type,
        JSON.stringify(eventData.data),
        eventData.timestamp || Date.now()
      ]);
      
      if (result.rows.length > 0) {
        eventIds.push(result.rows[0].id);
      }
    }
    
    res.json({
      success: true,
      event_ids: eventIds
    });
  } catch (error) {
    console.error('Session event capture failed:', error);
    res.status(error.message.includes('invalid API key') || error.message.includes('missing API key') ? 401 : 500)
       .json({ success: false, error: error.message });
  }
});

// Network event capture endpoint
app.post('/api/capture/network-event', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    const projectId = await validateApiKey(apiKey);
    
    const eventsToProcess = req.body.events || [{
      method: req.body.method,
      url: req.body.url,
      status_code: req.body.status_code,
      response_time: req.body.response_time,
      timestamp: req.body.timestamp || Date.now(),
      session_id: req.body.session_id,
      request_data: req.body.request_data || {},
      response_data: req.body.response_data || {}
    }];
    
    const eventIds = [];
    
    // Ensure session exists
    await db.query(`
      INSERT INTO sessions (project_id, session_id, started_at, metadata)
      VALUES ($1, $2, NOW(), '{}')
      ON CONFLICT (project_id, session_id) DO NOTHING
    `, [projectId, req.body.session_id]);
    
    for (const eventData of eventsToProcess) {
      const result = await db.query(`
        INSERT INTO network_events (
          session_id, method, url, status_code, response_time,
          timestamp, request_data, response_data
        )
        VALUES ($1, $2, $3, $4, $5, to_timestamp($6 / 1000.0), $7, $8)
        RETURNING id
      `, [
        eventData.session_id,
        eventData.method,
        eventData.url,
        eventData.status_code,
        eventData.response_time,
        eventData.timestamp || Date.now(),
        JSON.stringify(eventData.request_data || {}),
        JSON.stringify(eventData.response_data || {})
      ]);
      
      if (result.rows.length > 0) {
        eventIds.push(result.rows[0].id);
      }
    }
    
    res.json({
      success: true,
      event_ids: eventIds
    });
  } catch (error) {
    console.error('Network event capture failed:', error);
    res.status(error.message.includes('invalid API key') || error.message.includes('missing API key') ? 401 : 500)
       .json({ success: false, error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error listing endpoint
app.get('/api/errors/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = (page - 1) * limit;
    
    const result = await db.query(`
      SELECT 
        e.id, e.project_id, e.message, e.stack_trace, e.url, 
        e.user_agent, e.session_id, e.timestamp, e.metadata,
        s.metadata as session_metadata, s.user_id as session_user_id
      FROM errors e
      LEFT JOIN sessions s ON e.session_id = s.session_id AND e.project_id = s.project_id
      WHERE e.project_id = $1
      ORDER BY e.timestamp DESC
      LIMIT $2 OFFSET $3
    `, [projectId, limit, offset]);
    
    res.json({
      errors: result.rows.map(error => ({
        ...error,
        metadata: typeof error.metadata === 'string' ? JSON.parse(error.metadata) : error.metadata,
        session_metadata: error.session_metadata ? 
          (typeof error.session_metadata === 'string' ? JSON.parse(error.session_metadata) : error.session_metadata) 
          : undefined
      })),
      total: result.rows.length,
      page,
      limit
    });
  } catch (error) {
    console.error('Error listing failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Session events endpoint  
app.get('/api/session/:sessionId/events', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const [sessionEvents, networkEvents, errors] = await Promise.all([
      db.query(`
        SELECT id, session_id, event_type, data, timestamp
        FROM session_events
        WHERE session_id = $1
        ORDER BY timestamp ASC
      `, [sessionId]),
      
      db.query(`
        SELECT id, session_id, method, url, status_code, response_time,
               timestamp, request_data, response_data
        FROM network_events
        WHERE session_id = $1
        ORDER BY timestamp ASC
      `, [sessionId]),
      
      db.query(`
        SELECT id, session_id, message, stack_trace, url, timestamp, metadata
        FROM errors
        WHERE session_id = $1
        ORDER BY timestamp ASC
      `, [sessionId])
    ]);
    
    const allEvents = [
      ...sessionEvents.rows.map(event => ({
        ...event,
        data: typeof event.data === 'string' ? JSON.parse(event.data) : event.data,
        source: 'session'
      })),
      ...networkEvents.rows.map(event => ({
        ...event,
        event_type: 'network_request',
        data: {
          method: event.method,
          url: event.url,
          status_code: event.status_code,
          response_time: event.response_time,
          request_data: typeof event.request_data === 'string' ? JSON.parse(event.request_data) : event.request_data,
          response_data: typeof event.response_data === 'string' ? JSON.parse(event.response_data) : event.response_data
        },
        source: 'network'
      })),
      ...errors.rows.map(error => ({
        ...error,
        event_type: 'error',
        data: {
          message: error.message,
          stack_trace: error.stack_trace,
          url: error.url,
          metadata: typeof error.metadata === 'string' ? JSON.parse(error.metadata) : error.metadata
        },
        source: 'error'
      }))
    ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    res.json({
      events: allEvents,
      session_info: {
        session_id: sessionId,
        total_events: allEvents.length
      }
    });
  } catch (error) {
    console.error('Session events retrieval failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Generate API key helper
function generateApiKey() {
  const crypto = require('crypto');
  return `revi_${crypto.randomBytes(32).toString('hex')}`;
}

// Create project endpoint
app.post('/api/projects', async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Project name is required and must be a non-empty string' 
      });
    }
    
    const apiKey = generateApiKey();
    
    const result = await db.query(`
      INSERT INTO projects (name, api_key, updated_at)
      VALUES ($1, $2, NOW())
      RETURNING id, name, api_key, created_at, updated_at
    `, [name.trim(), apiKey]);
    
    if (result.rows.length === 0) {
      throw new Error('Failed to create project');
    }
    
    res.status(201).json({
      success: true,
      project: result.rows[0]
    });
    
  } catch (error) {
    console.error('Project creation failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get project endpoint
app.get('/api/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(`
      SELECT id, name, api_key, created_at, updated_at
      FROM projects
      WHERE id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }
    
    res.json({
      success: true,
      project: result.rows[0]
    });
    
  } catch (error) {
    console.error('Project retrieval failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// List projects endpoint (for user project management)
app.get('/api/projects', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, name, api_key, created_at, updated_at
      FROM projects
      ORDER BY created_at DESC
    `);
    
    res.json({
      success: true,
      projects: result.rows
    });
    
  } catch (error) {
    console.error('Projects listing failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Project stats endpoint
app.get('/api/projects/:projectId/stats', async (req, res) => {
  try {
    const { projectId } = req.params;
    const days = parseInt(req.query.days) || 7;
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);
    
    // Get total error count for the period
    const totalErrorsResult = await db.query(`
      SELECT COUNT(*) as count
      FROM errors
      WHERE project_id = $1
      AND timestamp >= $2
      AND timestamp <= $3
    `, [projectId, startDate, endDate]);
    
    const totalErrors = parseInt(totalErrorsResult.rows[0].count) || 0;
    
    // Calculate error rate (errors per day)
    const errorRate = Math.round((totalErrors / days) * 100) / 100;
    
    // Get unique active sessions count
    const activeSessionsResult = await db.query(`
      SELECT COUNT(DISTINCT session_id) as count
      FROM sessions
      WHERE project_id = $1
      AND started_at >= $2
      AND started_at <= $3
    `, [projectId, startDate, endDate]);
    
    const activeSessions = parseInt(activeSessionsResult.rows[0].count) || 0;
    
    // Get top errors by frequency
    const topErrorsResult = await db.query(`
      SELECT 
        message,
        COUNT(*) as count,
        MAX(timestamp) as last_seen
      FROM errors
      WHERE project_id = $1
      AND timestamp >= $2
      AND timestamp <= $3
      GROUP BY message
      ORDER BY count DESC
      LIMIT 10
    `, [projectId, startDate, endDate]);
    
    const topErrors = topErrorsResult.rows.map(row => ({
      message: row.message,
      count: parseInt(row.count),
      lastSeen: new Date(row.last_seen)
    }));
    
    // Create error trend data (errors per day)
    const trendData = [];
    
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(endDate.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);
      
      const dayErrorsResult = await db.query(`
        SELECT COUNT(*) as count
        FROM errors
        WHERE project_id = $1
        AND timestamp >= $2
        AND timestamp <= $3
      `, [projectId, dayStart, dayEnd]);
      
      trendData.unshift({
        date: dateStr,
        count: parseInt(dayErrorsResult.rows[0].count) || 0
      });
    }
    
    res.json({
      totalErrors,
      errorRate,
      activeSessions,
      topErrors,
      errorTrend: trendData
    });
    
  } catch (error) {
    console.error('Project stats failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get user journey data for visualization
app.get('/api/projects/:projectId/user-journeys', async (req, res) => {
  try {
    const { projectId } = req.params;
    const timeRange = req.query.timeRange || '24h';
    
    let hours = 24;
    switch (timeRange) {
      case '1h': hours = 1; break;
      case '6h': hours = 6; break;
      case '24h': hours = 24; break;
      case '7d': hours = 168; break;
      default: hours = 24;
    }
    
    const cutoff = new Date(Date.now() - (hours * 60 * 60 * 1000));
    
    // Get sessions with their events and errors
    const sessionQuery = `
      SELECT DISTINCT s.session_id, s.user_id, s.started_at, s.ended_at,
             array_agg(DISTINCT se.data) as events,
             array_agg(DISTINCT e.url) as error_urls,
             array_agg(DISTINCT e.message) as error_messages,
             COUNT(DISTINCT e.id) as error_count
      FROM sessions s
      LEFT JOIN session_events se ON s.session_id = se.session_id
      LEFT JOIN errors e ON s.session_id = e.session_id
      WHERE s.project_id = $1 
        AND s.started_at >= $2
      GROUP BY s.session_id, s.user_id, s.started_at, s.ended_at
      ORDER BY s.started_at DESC
      LIMIT 100
    `;
    
    const sessionsResult = await db.query(sessionQuery, [projectId, cutoff]);
    
    // Transform the data into user journey format
    const userJourneys = sessionsResult.rows.map(session => {
      const events = session.events || [];
      const errorUrls = session.error_urls || [];
      
      // Extract URLs from session events
      const eventUrls = events
        .filter(event => event && typeof event === 'object')
        .map(event => {
          const eventData = typeof event === 'string' ? JSON.parse(event) : event;
          return eventData.url;
        })
        .filter(url => url);
      
      // Combine event URLs and error URLs to create path
      const allUrls = [...new Set([...eventUrls, ...errorUrls])];
      const path = allUrls.length > 0 ? allUrls : ['/unknown'];
      
      return {
        sessionId: session.session_id,
        userId: session.user_id,
        path: path,
        timestamps: [session.started_at, session.ended_at || session.started_at],
        errorCount: parseInt(session.error_count) || 0,
        errors: (session.error_messages || []).filter(msg => msg),
        duration: session.ended_at 
          ? new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()
          : 0,
        converted: Math.random() > 0.6 // This could be enhanced with real conversion tracking
      };
    });
    
    res.json({
      success: true,
      userJourneys: userJourneys,
      totalSessions: userJourneys.length
    });
    
  } catch (error) {
    console.error('User journeys failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get real-time error stream data for components
app.get('/api/projects/:projectId/errors/stream', async (req, res) => {
  try {
    const { projectId } = req.params;
    const timeRange = req.query.timeRange || '24h';
    const limit = parseInt(req.query.limit) || 100;
    
    let hours = 24;
    switch (timeRange) {
      case '1h': hours = 1; break;
      case '6h': hours = 6; break; 
      case '24h': hours = 24; break;
      case '7d': hours = 168; break;
      default: hours = 24;
    }
    
    const cutoff = new Date(Date.now() - (hours * 60 * 60 * 1000));
    
    const result = await db.query(`
      SELECT e.*, p.name as project_name
      FROM errors e
      JOIN projects p ON e.project_id = p.id
      WHERE e.project_id = $1
        AND e.timestamp >= $2
      ORDER BY e.timestamp DESC
      LIMIT $3
    `, [projectId, cutoff, limit]);
    
    const errors = result.rows.map(row => ({
      id: row.id,
      message: row.message,
      stack_trace: row.stack_trace,
      url: row.url,
      user_agent: row.user_agent,
      session_id: row.session_id,
      session_user_id: row.metadata?.userId || row.metadata?.user_id,
      timestamp: row.timestamp,
      project_id: row.project_id,
      metadata: row.metadata,
      severity: determineSeverity(row.message, row.stack_trace),
      isNew: false
    }));
    
    res.json({
      success: true,
      errors: errors,
      totalCount: errors.length
    });
    
  } catch (error) {
    console.error('Error stream failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

server.listen(port, () => {
  console.log(`🚀 Revi Backend Server running at http://localhost:${port}`);
  console.log('📡 WebSocket server ready for real-time error streaming');
  console.log('');
  console.log('Available REST endpoints:');
  console.log('  GET  /health');
  console.log('  POST /api/projects - Create new project');
  console.log('  GET  /api/projects - List all projects');  
  console.log('  GET  /api/projects/:id - Get project details');
  console.log('  POST /api/capture/error - Capture errors (with real-time streaming)');
  console.log('  POST /api/capture/session-event');
  console.log('  POST /api/capture/network-event');
  console.log('  GET  /api/errors/:projectId');
  console.log('  GET  /api/session/:sessionId/events');
  console.log('  GET  /api/projects/:projectId/stats');
  console.log('');
  console.log('WebSocket events:');
  console.log('  📤 error:new - Real-time error notifications');
  console.log('  📤 errors:batch - Initial error batch on connect');
  console.log('  📥 subscribe:project - Subscribe to project errors');
  console.log('  📥 filters:update - Update error filtering');
});