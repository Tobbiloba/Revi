# Revi Monitor

Client-side SDK for error monitoring and session replay.

## Installation

```bash
npm install revi-monitor
```

## Quick Start

```javascript
import { Monitor } from 'revi-monitor';

const revi = new Monitor({
  apiKey: 'your-api-key',
  environment: 'production',
  debug: false
});

// Capture errors automatically or manually
revi.captureException(new Error('Something went wrong'));
revi.captureMessage('Custom message', { level: 'info' });

// Add context
revi.setUserContext({
  id: 'user-123',
  email: 'user@example.com'
});

revi.addBreadcrumb({
  message: 'User clicked button',
  category: 'ui',
  level: 'info'
});
```

## Configuration

```javascript
const revi = new Monitor({
  apiKey: 'your-api-key',
  apiUrl: 'https://api.revi.dev', // Optional, defaults to Revi API
  environment: 'production',
  userId: 'user-123',
  release: '1.0.0',
  debug: false,
  
  // Sampling rates
  sampleRate: 1.0, // 100% of errors
  sessionSampleRate: 0.1, // 10% of sessions
  
  // Privacy settings
  privacy: {
    maskInputs: true,
    maskPasswords: true,
    maskCreditCards: true,
    allowUrls: ['/api/*'],
    denyUrls: ['/admin/*']
  },
  
  // Performance monitoring
  performance: {
    captureWebVitals: true,
    captureResourceTiming: false,
    captureNavigationTiming: true
  },
  
  // Session replay
  replay: {
    enabled: true,
    maskAllInputs: false,
    maskAllText: false,
    blockSelector: '.sensitive',
    maskSelector: '.mask-content'
  },
  
  // Event filtering
  beforeSend: (event) => {
    // Filter or modify events before sending
    if (event.message.includes('ignore')) {
      return null; // Don't send this event
    }
    return event;
  }
});
```

## React Integration

```jsx
import React, { useEffect } from 'react';
import { Monitor } from 'revi-monitor';

// Create monitor instance
const revi = new Monitor({
  apiKey: 'your-api-key',
  environment: process.env.NODE_ENV
});

// Error Boundary
class ReviErrorBoundary extends React.Component {
  componentDidCatch(error, errorInfo) {
    revi.captureException(error, {
      extra: errorInfo
    });
  }

  render() {
    return this.props.children;
  }
}

// React Hook
export function useRevi() {
  return {
    captureException: revi.captureException.bind(revi),
    captureMessage: revi.captureMessage.bind(revi),
    addBreadcrumb: revi.addBreadcrumb.bind(revi),
    setUserContext: revi.setUserContext.bind(revi)
  };
}

// Usage in component
function MyComponent() {
  const { captureMessage, addBreadcrumb } = useRevi();

  const handleClick = () => {
    addBreadcrumb({
      message: 'Button clicked',
      category: 'ui'
    });
    
    try {
      // Some operation
    } catch (error) {
      captureMessage('Operation failed', {
        level: 'error',
        extra: { buttonId: 'submit' }
      });
    }
  };

  return <button onClick={handleClick}>Click me</button>;
}

export default function App() {
  return (
    <ReviErrorBoundary>
      <MyComponent />
    </ReviErrorBoundary>
  );
}
```

## CDN Usage

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.jsdelivr.net/npm/revi-monitor/dist/revi-monitor.umd.js"></script>
</head>
<body>
  <script>
    const revi = new ReviMonitor.Monitor({
      apiKey: 'your-api-key',
      environment: 'production'
    });

    // Use the monitor
    revi.captureMessage('Page loaded');
  </script>
</body>
</html>
```

## Performance Monitoring

```javascript
// Mark important events
revi.mark('feature-start');
// ... feature code ...
revi.mark('feature-end');

// Measure duration
const duration = revi.measure('feature-duration', 'feature-start', 'feature-end');

// Get Web Vitals
const vitals = revi.getWebVitals();
console.log('LCP:', vitals.lcp);
console.log('FID:', vitals.fid);
console.log('CLS:', vitals.cls);
```

## Session Management

```javascript
// Get current session ID
const sessionId = revi.getSessionId();

// End current session (starts a new one)
revi.endSession();

// Manually flush data
revi.flush();
```

## Privacy & GDPR Compliance

The SDK respects user privacy and includes several features for GDPR compliance:

- Input masking for sensitive fields
- URL sanitization
- Configurable data filtering
- Opt-out mechanisms

```javascript
// Configure privacy settings
const revi = new Monitor({
  apiKey: 'your-api-key',
  privacy: {
    maskInputs: true, // Mask form inputs
    maskPasswords: true, // Always mask password fields
    maskCreditCards: true, // Mask credit card numbers
    allowUrls: ['/api/*'], // Only capture from these URLs
    denyUrls: ['/admin/*'] // Never capture from these URLs
  }
});

// User consent handling
if (userHasGivenConsent) {
  const revi = new Monitor(config);
} else {
  // Don't initialize or initialize with minimal features
}
```

## API Reference

### Monitor

#### Constructor

```typescript
new Monitor(config: ReviConfig)
```

#### Methods

- `captureException(error: Error, options?)` - Capture an error
- `captureMessage(message: string, options?)` - Capture a message
- `addBreadcrumb(breadcrumb)` - Add a breadcrumb
- `setUserContext(user)` - Set user context
- `setTags(tags)` - Set tags for future events
- `setExtra(extra)` - Set extra data for future events
- `getSessionId()` - Get current session ID
- `endSession()` - End current session
- `mark(name)` - Create performance mark
- `measure(name, start?, end?)` - Measure performance
- `getWebVitals()` - Get Core Web Vitals
- `flush()` - Manually flush queued data
- `destroy()` - Clean up and destroy monitor

### Configuration Types

See `src/types.ts` for complete type definitions.

## Browser Support

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Size

- Core bundle: ~15KB gzipped
- With all features: ~25KB gzipped

## License

MIT
