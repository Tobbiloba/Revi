const React = require('react');

const ReviContext = React.createContext({
  monitor: null,
  isInitialized: false,
  sessionId: ''
});

const useRevi = () => React.useContext(ReviContext);

function ReviProvider({
  children,
  apiKey,
  apiUrl = 'https://api.revi.dev',
  environment = 'production',
  debug = false,
  userId,
  userEmail,
  sampleRate = 1.0,
  sessionSampleRate = 1.0
}) {
  const [monitor, setMonitor] = React.useState(null);
  const [isInitialized, setIsInitialized] = React.useState(false);
  const [sessionId, setSessionId] = React.useState('');
  const initRef = React.useRef(false);

  React.useEffect(() => {
    // Prevent double initialization
    if (initRef.current) return;
    initRef.current = true;

    if (typeof window === 'undefined') return;

    // Dynamically import the Monitor class to avoid bundling issues
    async function initializeMonitor() {
      try {
        // Import from the main bundle at runtime
        const { Monitor } = await import('revi-monitor');
        
        const config = {
          apiKey,
          apiUrl,
          environment,
          debug,
          userId,
          sampleRate,
          sessionSampleRate,
          // Smart defaults that work for most applications
          maxBreadcrumbs: 50,
          privacy: {
            maskInputs: true,
            maskPasswords: true,
            maskCreditCards: true
          },
          performance: {
            captureWebVitals: true,
            captureResourceTiming: false,
            captureNavigationTiming: true
          },
          replay: {
            enabled: true,
            maskAllInputs: false,
            maskAllText: false
          }
        };

        const reviMonitor = new Monitor(config);
        setMonitor(reviMonitor);
        setSessionId(reviMonitor.getSessionId());
        setIsInitialized(true);

        // Set user context if provided
        if (userId || userEmail) {
          reviMonitor.setUserContext({
            id: userId,
            email: userEmail
          });
        }

        if (debug) {
          console.log('Revi: Initialized successfully', { sessionId: reviMonitor.getSessionId() });
        }

      } catch (error) {
        if (debug) {
          console.error('Revi: Failed to initialize', error);
        }
      }
    }

    initializeMonitor();

    // Cleanup on unmount
    return () => {
      if (monitor) {
        monitor.destroy();
      }
    };
  }, [apiKey, apiUrl, environment, debug, userId, userEmail, sampleRate, sessionSampleRate]);

  const contextValue = {
    monitor,
    isInitialized,
    sessionId
  };

  return React.createElement(ReviContext.Provider, { value: contextValue }, children);
}

module.exports = { ReviProvider, useRevi };