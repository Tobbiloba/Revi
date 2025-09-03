// Script to populate the database with test data for dashboard testing

import { db } from '../projects/db';

interface TestDataOptions {
  projectId: number;
  errorCount: number;
  sessionCount: number;
  daysBack: number;
}

const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPad; CPU OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
];

const errorMessages = [
  'TypeError: Cannot read property \'length\' of undefined',
  'ReferenceError: $ is not defined',
  'TypeError: Cannot read property \'map\' of null',
  'SyntaxError: Unexpected token \'}\'',
  'TypeError: Cannot read property \'id\' of undefined',
  'ReferenceError: React is not defined',
  'TypeError: Cannot set property \'innerHTML\' of null',
  'Error: Network request failed',
  'TypeError: Cannot read property \'forEach\' of undefined',
  'RangeError: Maximum call stack size exceeded',
  'TypeError: Cannot read property \'style\' of null',
  'Error: Failed to fetch',
  'TypeError: Cannot read property \'addEventListener\' of null',
  'Error: Invalid JSON response',
  'TypeError: Cannot read property \'value\' of undefined'
];

const urls = [
  '/dashboard',
  '/projects',
  '/errors',
  '/settings',
  '/profile',
  '/login',
  '/signup',
  '/api/users',
  '/api/projects',
  '/api/errors',
  '/shop',
  '/cart',
  '/checkout',
  '/product/123',
  '/category/electronics'
];

const stackTraces = [
  `Error: Cannot read property 'length' of undefined
    at Object.calculateTotal (utils.js:45:12)
    at ShoppingCart.render (ShoppingCart.jsx:78:23)
    at processChild (react-dom.js:3991:14)
    at resolve (react-dom.js:4007:5)`,
  `ReferenceError: $ is not defined
    at HTMLDocument.<anonymous> (main.js:12:5)
    at fire (jquery.min.js:3187:50)
    at Object.fireWith (jquery.min.js:3317:7)
    at Function.ready (jquery.min.js:3143:2)`,
  `TypeError: Cannot read property 'map' of null
    at ProductList.render (ProductList.jsx:34:18)
    at finishClassComponent (react-dom.js:17485:31)
    at updateClassComponent (react-dom.js:17435:24)
    at beginWork (react-dom.js:19073:16)`
];

function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function randomDate(daysBack: number): Date {
  const now = new Date();
  const randomDays = Math.floor(Math.random() * daysBack);
  const randomHours = Math.floor(Math.random() * 24);
  const randomMinutes = Math.floor(Math.random() * 60);
  
  const date = new Date(now);
  date.setDate(date.getDate() - randomDays);
  date.setHours(randomHours);
  date.setMinutes(randomMinutes);
  
  return date;
}

function generateSessionId(): string {
  return `sess_${Math.random().toString(36).substring(2, 15)}`;
}

function generateUserId(): string {
  return `user_${Math.random().toString(36).substring(2, 10)}`;
}

async function populateTestData(options: TestDataOptions) {
  const { projectId, errorCount, sessionCount, daysBack } = options;
  
  console.log(`Populating test data for project ${projectId}...`);
  console.log(`Creating ${errorCount} errors and ${sessionCount} sessions over ${daysBack} days`);
  
  try {
    // Create test sessions
    const sessions = [];
    for (let i = 0; i < sessionCount; i++) {
      const sessionId = generateSessionId();
      const userId = generateUserId();
      const startedAt = randomDate(daysBack);
      const sessionDuration = Math.floor(Math.random() * 3600) + 60; // 1 minute to 1 hour
      const endedAt = new Date(startedAt.getTime() + sessionDuration * 1000);
      
      const metadata = {
        user_id: userId,
        userId: userId,
        device: randomChoice(['desktop', 'mobile', 'tablet']),
        country: randomChoice(['US', 'CA', 'UK', 'DE', 'FR', 'AU', 'JP']),
        referrer: randomChoice(['google', 'direct', 'facebook', 'twitter', 'linkedin', null])
      };
      
      await db.exec`
        INSERT INTO sessions (session_id, project_id, user_id, started_at, ended_at, metadata)
        VALUES (${sessionId}, ${projectId}, ${userId}, ${startedAt}, ${endedAt}, ${metadata})
        ON CONFLICT (session_id) DO NOTHING
      `;
      
      sessions.push({ sessionId, userId, startedAt, endedAt });
      
      if (i % 100 === 0) {
        console.log(`Created ${i}/${sessionCount} sessions...`);
      }
    }
    
    console.log(`✅ Created ${sessions.length} sessions`);
    
    // Create test errors
    for (let i = 0; i < errorCount; i++) {
      const session = randomChoice(sessions);
      const errorTime = new Date(
        session.startedAt.getTime() + 
        Math.random() * (session.endedAt.getTime() - session.startedAt.getTime())
      );
      
      const message = randomChoice(errorMessages);
      const url = randomChoice(urls);
      const userAgent = randomChoice(userAgents);
      const stackTrace = randomChoice(stackTraces);
      
      // Add some status variety
      const statusOptions = ['new', 'new', 'new', 'investigating', 'resolved', 'ignored']; // Weighted toward 'new'
      const status = randomChoice(statusOptions);
      
      const metadata = {
        status,
        level: randomChoice(['error', 'warning', 'info']),
        fingerprint: `${message.split(' ').slice(0, 3).join('_')}_${Math.random().toString(36).substring(2, 8)}`,
        browser_version: '120.0.0',
        environment: 'production',
        release: '1.0.0'
      };
      
      await db.exec`
        INSERT INTO errors (project_id, message, stack_trace, url, user_agent, session_id, timestamp, metadata)
        VALUES (${projectId}, ${message}, ${stackTrace}, ${url}, ${userAgent}, ${session.sessionId}, ${errorTime}, ${metadata})
      `;
      
      if (i % 100 === 0) {
        console.log(`Created ${i}/${errorCount} errors...`);
      }
    }
    
    console.log(`✅ Created ${errorCount} errors`);
    
    // Create some session events for richer data
    console.log('Creating session events...');
    for (let i = 0; i < Math.min(sessions.length, 50); i++) {
      const session = sessions[i];
      const eventCount = Math.floor(Math.random() * 20) + 5; // 5-25 events per session
      
      for (let j = 0; j < eventCount; j++) {
        const eventTime = new Date(
          session.startedAt.getTime() + 
          (j / eventCount) * (session.endedAt.getTime() - session.startedAt.getTime())
        );
        
        const eventType = randomChoice(['click', 'page_view', 'form_submit', 'api_call']);
        const eventData = {
          type: eventType,
          target: eventType === 'click' ? randomChoice(['button', 'link', 'input']) : undefined,
          page: eventType === 'page_view' ? randomChoice(urls) : undefined,
          form: eventType === 'form_submit' ? randomChoice(['login', 'signup', 'contact']) : undefined,
          api: eventType === 'api_call' ? randomChoice(['/api/users', '/api/projects', '/api/data']) : undefined
        };
        
        await db.exec`
          INSERT INTO session_events (session_id, event_type, data, timestamp)
          VALUES (${session.sessionId}, ${eventType}, ${eventData}, ${eventTime})
        `;
      }
    }
    
    console.log('✅ Created session events');
    console.log('🎉 Test data population complete!');
    
  } catch (error) {
    console.error('Error populating test data:', error);
    throw error;
  }
}

// Export the function for use in other scripts
export { populateTestData };

// Run the script if called directly
if (require.main === module) {
  const options: TestDataOptions = {
    projectId: 1, // Default project ID
    errorCount: 500,
    sessionCount: 200,
    daysBack: 30
  };
  
  populateTestData(options)
    .then(() => {
      console.log('✅ Data population completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Data population failed:', error);
      process.exit(1);
    });
}