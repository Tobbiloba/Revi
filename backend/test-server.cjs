const express = require('express');
const cors = require('cors');
const { Client } = require('pg');

const app = express();
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
    
    for (const errorData of errorsToProcess) {
      const result = await db.query(`
        INSERT INTO errors (
          project_id, message, stack_trace, url, user_agent, 
          session_id, metadata, timestamp
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING id
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
        errorIds.push(result.rows[0].id);
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

app.listen(port, () => {
  console.log(`Test server running at http://localhost:${port}`);
  console.log('Available endpoints:');
  console.log('  GET  /health');
  console.log('  POST /api/capture/error');
  console.log('  POST /api/capture/session-event');
  console.log('  POST /api/capture/network-event');
  console.log('  GET  /api/errors/:projectId');
  console.log('  GET  /api/session/:sessionId/events');
});