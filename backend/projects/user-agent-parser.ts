// User agent parsing utility for browser and OS detection

export interface ParsedUserAgent {
  browser: string;
  browserVersion?: string;
  os: string;
  osVersion?: string;
  device?: string;
  isBot: boolean;
}

// Simple user agent parser without external dependencies
export function parseUserAgent(userAgent: string): ParsedUserAgent {
  if (!userAgent) {
    return {
      browser: 'Unknown',
      os: 'Unknown',
      isBot: false
    };
  }

  const ua = userAgent.toLowerCase();
  
  // Detect bots first
  const isBot = /bot|crawler|spider|crawling|googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebookexternalhit|twitterbot|rogerbot|linkedinbot|embedly|quora|showyoubot|outbrain|pinterest|slackbot|vkshare|w3c_validator|redditbot|applebot|whatsapp|flipboard|tumblr|bitlybot|skypeuripreview|nuzzel|discordbot|qwantbot|pinterestbot|bitrix|telegram/i.test(ua);
  
  if (isBot) {
    return {
      browser: 'Bot/Crawler',
      os: 'Unknown',
      isBot: true
    };
  }

  // Browser detection
  let browser = 'Unknown';
  let browserVersion = '';

  if (ua.includes('firefox/')) {
    browser = 'Firefox';
    const match = ua.match(/firefox\/([0-9.]+)/);
    browserVersion = match ? match[1] : '';
  } else if (ua.includes('chrome/') && !ua.includes('edge')) {
    browser = 'Chrome';
    const match = ua.match(/chrome\/([0-9.]+)/);
    browserVersion = match ? match[1] : '';
  } else if (ua.includes('safari/') && !ua.includes('chrome')) {
    browser = 'Safari';
    const match = ua.match(/version\/([0-9.]+)/);
    browserVersion = match ? match[1] : '';
  } else if (ua.includes('edge/')) {
    browser = 'Edge';
    const match = ua.match(/edge\/([0-9.]+)/);
    browserVersion = match ? match[1] : '';
  } else if (ua.includes('edg/')) {
    browser = 'Edge';
    const match = ua.match(/edg\/([0-9.]+)/);
    browserVersion = match ? match[1] : '';
  } else if (ua.includes('opera/') || ua.includes('opr/')) {
    browser = 'Opera';
    const match = ua.match(/(?:opera|opr)\/([0-9.]+)/);
    browserVersion = match ? match[1] : '';
  } else if (ua.includes('msie')) {
    browser = 'Internet Explorer';
    const match = ua.match(/msie ([0-9.]+)/);
    browserVersion = match ? match[1] : '';
  }

  // OS detection
  let os = 'Unknown';
  let osVersion = '';

  if (ua.includes('windows nt')) {
    os = 'Windows';
    const match = ua.match(/windows nt ([0-9.]+)/);
    if (match) {
      const version = match[1];
      switch (version) {
        case '10.0': osVersion = '10'; break;
        case '6.3': osVersion = '8.1'; break;
        case '6.2': osVersion = '8'; break;
        case '6.1': osVersion = '7'; break;
        case '6.0': osVersion = 'Vista'; break;
        default: osVersion = version;
      }
    }
  } else if (ua.includes('mac os x') || ua.includes('macos')) {
    os = 'macOS';
    const match = ua.match(/mac os x ([0-9_]+)/);
    if (match) {
      osVersion = match[1].replace(/_/g, '.');
    }
  } else if (ua.includes('linux')) {
    os = 'Linux';
    if (ua.includes('ubuntu')) osVersion = 'Ubuntu';
    else if (ua.includes('debian')) osVersion = 'Debian';
    else if (ua.includes('fedora')) osVersion = 'Fedora';
    else if (ua.includes('centos')) osVersion = 'CentOS';
  } else if (ua.includes('android')) {
    os = 'Android';
    const match = ua.match(/android ([0-9.]+)/);
    osVersion = match ? match[1] : '';
  } else if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) {
    os = 'iOS';
    const match = ua.match(/os ([0-9_]+)/);
    if (match) {
      osVersion = match[1].replace(/_/g, '.');
    }
  }

  // Device detection
  let device = '';
  if (ua.includes('mobile') || ua.includes('android')) {
    device = 'Mobile';
  } else if (ua.includes('tablet') || ua.includes('ipad')) {
    device = 'Tablet';
  } else {
    device = 'Desktop';
  }

  return {
    browser,
    browserVersion,
    os,
    osVersion,
    device,
    isBot
  };
}

// Helper function to get browser display name
export function getBrowserDisplayName(browser: string, version?: string): string {
  if (version) {
    const majorVersion = version.split('.')[0];
    return `${browser} ${majorVersion}`;
  }
  return browser;
}

// Helper function to get OS display name
export function getOSDisplayName(os: string, version?: string): string {
  if (version && os !== 'Unknown') {
    return `${os} ${version}`;
  }
  return os;
}

// Group browsers for analytics (combine minor versions)
export function groupBrowserForAnalytics(browser: string, version?: string): string {
  const major = version ? version.split('.')[0] : '';
  
  switch (browser) {
    case 'Chrome':
    case 'Firefox':
    case 'Safari':
    case 'Edge':
    case 'Opera':
      return major ? `${browser} ${major}` : browser;
    case 'Internet Explorer':
      return major ? `IE ${major}` : 'IE';
    case 'Bot/Crawler':
      return 'Bots';
    default:
      return browser;
  }
}

// Group OS for analytics
export function groupOSForAnalytics(os: string, version?: string): string {
  switch (os) {
    case 'Windows':
      return version ? `Windows ${version}` : 'Windows';
    case 'macOS':
      const major = version ? version.split('.')[0] : '';
      return major ? `macOS ${major}` : 'macOS';
    case 'iOS':
      const iosMajor = version ? version.split('.')[0] : '';
      return iosMajor ? `iOS ${iosMajor}` : 'iOS';
    case 'Android':
      const androidMajor = version ? version.split('.')[0] : '';
      return androidMajor ? `Android ${androidMajor}` : 'Android';
    case 'Linux':
      return version || 'Linux';
    default:
      return os;
  }
}