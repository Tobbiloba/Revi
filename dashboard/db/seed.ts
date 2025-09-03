#!/usr/bin/env tsx

import { config } from "dotenv";
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { projects, reviSessions, errors, sessionEvents, networkEvents } from './schema';

config({ path: ".env.local" });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
});

const db = drizzle(pool);

async function seed() {
  console.log('🌱 Seeding database with sample data...');

  try {
    // Check if demo project already exists
    let projectResult = await pool.query(
      'SELECT * FROM projects WHERE api_key = $1',
      ['demo_api_key_12345']
    );
    
    let project;
    if (projectResult.rows.length === 0) {
      // Create a demo project
      projectResult = await pool.query(
        'INSERT INTO projects (name, api_key) VALUES ($1, $2) RETURNING *',
        ['Demo App', 'demo_api_key_12345']
      );
      project = projectResult.rows[0];
      console.log('✅ Created demo project:', project.name);
    } else {
      project = projectResult.rows[0];
      console.log('✅ Using existing demo project:', project.name);
    }

    // Clear existing sample data for this project
    await pool.query('DELETE FROM network_events WHERE session_id LIKE $1', ['session_%']);
    await pool.query('DELETE FROM session_events WHERE session_id LIKE $1', ['session_%']);
    await pool.query('DELETE FROM errors WHERE project_id = $1', [project.id]);
    await pool.query('DELETE FROM sessions WHERE project_id = $1', [project.id]);
    console.log('✅ Cleared existing sample data');

    // Generate sample sessions
    const sessionIds = [
      'session_user123_20240901_001',
      'session_user456_20240901_002', 
      'session_user789_20240901_003',
      'session_user123_20240902_001',
      'session_user456_20240902_002',
    ];

    for (const sessionId of sessionIds) {
      await pool.query(
        'INSERT INTO sessions (project_id, session_id, user_id, started_at, metadata) VALUES ($1, $2, $3, $4, $5)',
        [
          project.id,
          sessionId,
          sessionId.split('_')[1],
          new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
          JSON.stringify({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
            ip: '192.168.1.' + Math.floor(Math.random() * 255),
            country: 'US',
            device: Math.random() > 0.5 ? 'desktop' : 'mobile'
          })
        ]
      );
    }

    console.log('✅ Created sample sessions');

    // Generate sample errors with realistic messages and stack traces
    const errorMessages = [
      'TypeError: Cannot read property \'map\' of undefined',
      'ReferenceError: handleClick is not defined', 
      'Error: Network request failed',
      'TypeError: Cannot read property \'length\' of null',
      'Error: Invalid API key provided',
      'ReferenceError: $ is not defined',
      'TypeError: Cannot read property \'toLowerCase\' of undefined',
      'Error: Failed to fetch user data',
      'TypeError: Cannot read property \'id\' of null',
      'Error: Request timeout after 5000ms'
    ];

    const stackTraces = [
      'at HomePage.render (HomePage.jsx:45:12)\nat React.Component.render (react.js:123:45)',
      'at ButtonComponent.handleClick (Button.jsx:12:8)\nat HTMLButtonElement.<anonymous> (Button.jsx:25:10)',
      'at fetch.then (api.js:34:12)\nat Promise.then (promise.js:88:23)',
      'at UserList.map (UserList.jsx:78:23)\nat Array.map (Array.prototype.map)',
      'at AuthService.authenticate (auth.js:56:12)\nat LoginForm.submit (LoginForm.jsx:89:5)',
    ];

    const urls = [
      'https://demo-app.com/',
      'https://demo-app.com/dashboard',
      'https://demo-app.com/profile', 
      'https://demo-app.com/settings',
      'https://demo-app.com/api/users',
      'https://demo-app.com/login',
    ];

    // Create errors distributed over the last 7 days
    for (let i = 0; i < 50; i++) {
      const randomDate = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);
      const randomSessionId = sessionIds[Math.floor(Math.random() * sessionIds.length)];
      const randomMessage = errorMessages[Math.floor(Math.random() * errorMessages.length)];
      const randomStackTrace = stackTraces[Math.floor(Math.random() * stackTraces.length)];
      const randomUrl = urls[Math.floor(Math.random() * urls.length)];

      await pool.query(
        'INSERT INTO errors (project_id, message, stack_trace, url, user_agent, session_id, timestamp, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [
          project.id,
          randomMessage,
          randomStackTrace,
          randomUrl,
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          randomSessionId,
          randomDate,
          JSON.stringify({
            browser: Math.random() > 0.5 ? 'Chrome' : 'Safari',
            os: 'macOS',
            version: '1.0.0',
            userId: randomSessionId.split('_')[1],
            environment: 'production'
          })
        ]
      );
    }

    console.log('✅ Created sample errors');

    // Generate sample session events
    const eventTypes = ['click', 'input', 'scroll', 'navigation', 'form_submit'];
    
    for (const sessionId of sessionIds) {
      const numEvents = Math.floor(Math.random() * 20) + 5; // 5-25 events per session
      
      for (let i = 0; i < numEvents; i++) {
        const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
        const timestamp = new Date(Date.now() - Math.random() * 6 * 60 * 60 * 1000); // Last 6 hours
        
        let eventData = {};
        switch (eventType) {
          case 'click':
            eventData = {
              element: 'button',
              text: 'Submit Form',
              x: Math.floor(Math.random() * 1200),
              y: Math.floor(Math.random() * 800)
            };
            break;
          case 'input':
            eventData = {
              element: 'input',
              field: 'email',
              value: 'user@example.com'
            };
            break;
          case 'scroll':
            eventData = {
              scrollY: Math.floor(Math.random() * 2000),
              direction: Math.random() > 0.5 ? 'down' : 'up'
            };
            break;
          case 'navigation':
            eventData = {
              from: '/dashboard',
              to: '/profile',
              method: 'pushState'
            };
            break;
          case 'form_submit':
            eventData = {
              form: 'contact-form',
              fields: ['name', 'email', 'message']
            };
            break;
        }

        await pool.query(
          'INSERT INTO session_events (session_id, event_type, data, timestamp) VALUES ($1, $2, $3, $4)',
          [sessionId, eventType, eventData, timestamp]
        );
      }
    }

    console.log('✅ Created sample session events');

    // Generate sample network events
    const methods = ['GET', 'POST', 'PUT', 'DELETE'];
    const apiUrls = [
      '/api/users',
      '/api/posts',
      '/api/auth/login',
      '/api/profile',
      '/api/settings',
      '/api/dashboard/stats'
    ];

    for (const sessionId of sessionIds) {
      const numRequests = Math.floor(Math.random() * 15) + 3; // 3-18 requests per session
      
      for (let i = 0; i < numRequests; i++) {
        const method = methods[Math.floor(Math.random() * methods.length)];
        const url = 'https://demo-app.com' + apiUrls[Math.floor(Math.random() * apiUrls.length)];
        const statusCode = Math.random() > 0.1 ? 200 : (Math.random() > 0.5 ? 404 : 500); // 90% success
        const responseTime = Math.floor(Math.random() * 2000) + 50; // 50-2050ms
        const timestamp = new Date(Date.now() - Math.random() * 6 * 60 * 60 * 1000);

        await pool.query(
          'INSERT INTO network_events (session_id, method, url, status_code, response_time, timestamp, request_data, response_data) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [
            sessionId,
            method,
            url,
            statusCode,
            responseTime,
            timestamp,
            method === 'POST' ? JSON.stringify({ body: 'sample data' }) : null,
            statusCode === 200 ? JSON.stringify({ success: true, data: 'response' }) : JSON.stringify({ error: 'Failed request' })
          ]
        );
      }
    }

    console.log('✅ Created sample network events');
    console.log('🎉 Database seeded successfully!');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seed();
}