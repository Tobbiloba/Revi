'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Maximize2, Minimize2, RotateCw, Smartphone, Monitor } from 'lucide-react';

export interface MobileViewport {
  width: number;
  height: number;
  devicePixelRatio: number;
  orientation: 'portrait' | 'landscape';
  userAgent: string;
}

export interface ResponsiveConfig {
  breakpoints: {
    mobile: number;
    tablet: number;
    desktop: number;
  };
  defaultViewports: {
    mobile: MobileViewport;
    tablet: MobileViewport;
    desktop: MobileViewport;
  };
}

const DEFAULT_CONFIG: ResponsiveConfig = {
  breakpoints: {
    mobile: 768,
    tablet: 1024,
    desktop: 1200
  },
  defaultViewports: {
    mobile: {
      width: 375,
      height: 812,
      devicePixelRatio: 3,
      orientation: 'portrait',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15'
    },
    tablet: {
      width: 768,
      height: 1024,
      devicePixelRatio: 2,
      orientation: 'portrait',
      userAgent: 'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15'
    },
    desktop: {
      width: 1920,
      height: 1080,
      devicePixelRatio: 1,
      orientation: 'landscape',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  }
};

/**
 * Mobile responsive enhancements for session replay
 */
export function MobileResponsiveEnhancements({
  children,
  className,
  onViewportChange
}: {
  children: React.ReactNode;
  className?: string;
  onViewportChange?: (viewport: MobileViewport) => void;
}) {
  const [currentViewport, setCurrentViewport] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [actualViewport, setActualViewport] = useState<MobileViewport>(DEFAULT_CONFIG.defaultViewports.desktop);

  // Detect current screen size and set appropriate viewport
  useEffect(() => {
    const updateViewport = () => {
      const width = window.innerWidth;
      if (width < DEFAULT_CONFIG.breakpoints.mobile) {
        setCurrentViewport('mobile');
      } else if (width < DEFAULT_CONFIG.breakpoints.tablet) {
        setCurrentViewport('tablet');
      } else {
        setCurrentViewport('desktop');
      }
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  // Update actual viewport when current viewport changes
  useEffect(() => {
    const viewport = { ...DEFAULT_CONFIG.defaultViewports[currentViewport] };
    
    // Adjust for orientation
    if (currentViewport !== 'desktop' && orientation === 'landscape') {
      [viewport.width, viewport.height] = [viewport.height, viewport.width];
      viewport.orientation = 'landscape';
    }
    
    setActualViewport(viewport);
    onViewportChange?.(viewport);
  }, [currentViewport, orientation, onViewportChange]);

  const toggleOrientation = useCallback(() => {
    if (currentViewport !== 'desktop') {
      setOrientation(prev => prev === 'portrait' ? 'landscape' : 'portrait');
    }
  }, [currentViewport]);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  return (
    <div className={cn("relative", className)}>
      {/* Mobile Controls Bar */}
      <div className="flex items-center justify-between p-3 bg-gray-50 border-b border-gray-200 rounded-t-lg">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Device:</span>
          <div className="flex items-center gap-1">
            {(['mobile', 'tablet', 'desktop'] as const).map((viewport) => (
              <Button
                key={viewport}
                variant={currentViewport === viewport ? "default" : "ghost"}
                size="sm"
                onClick={() => setCurrentViewport(viewport)}
                className="px-2 py-1 h-8"
              >
                {viewport === 'mobile' && <Smartphone className="size-4" />}
                {viewport === 'tablet' && <Monitor className="size-4" />}
                {viewport === 'desktop' && <Monitor className="size-4" />}
                <span className="ml-1 capitalize">{viewport}</span>
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {currentViewport !== 'desktop' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleOrientation}
              className="px-2 py-1 h-8"
              title="Rotate device"
            >
              <RotateCw className="size-4" />
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleFullscreen}
            className="px-2 py-1 h-8"
            title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </Button>
          
          <div className="text-xs text-gray-600 ml-2">
            {actualViewport.width} × {actualViewport.height}
          </div>
        </div>
      </div>

      {/* Responsive Container */}
      <div
        className={cn(
          "relative bg-white transition-all duration-300 ease-in-out",
          isFullscreen && "fixed inset-0 z-50 bg-black",
          !isFullscreen && "border border-gray-200 rounded-b-lg"
        )}
        style={isFullscreen ? undefined : {
          minHeight: currentViewport === 'mobile' ? '600px' : '400px'
        }}
      >
        {/* Device Frame (only in non-fullscreen mode) */}
        {!isFullscreen && currentViewport !== 'desktop' && (
          <div className="flex items-center justify-center p-8">
            <div
              className={cn(
                "relative bg-black rounded-3xl p-3 shadow-2xl transition-all duration-500",
                currentViewport === 'mobile' && orientation === 'portrait' && "w-[380px]",
                currentViewport === 'mobile' && orientation === 'landscape' && "w-[820px]",
                currentViewport === 'tablet' && orientation === 'portrait' && "w-[780px]",
                currentViewport === 'tablet' && orientation === 'landscape' && "w-[1030px]"
              )}
            >
              {/* Device Screen */}
              <div
                className="bg-white rounded-2xl overflow-hidden"
                style={{
                  width: actualViewport.width,
                  height: Math.min(actualViewport.height, 800), // Limit height for better display
                  transform: `scale(${currentViewport === 'mobile' ? 0.8 : 0.75})`
                }}
              >
                {children}
              </div>
              
              {/* Device Home Indicator (for mobile) */}
              {currentViewport === 'mobile' && (
                <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-32 h-1 bg-gray-600 rounded-full opacity-50" />
              )}
            </div>
          </div>
        )}

        {/* Regular view for desktop or fullscreen */}
        {(isFullscreen || currentViewport === 'desktop') && (
          <div className="w-full h-full">
            {children}
          </div>
        )}

        {/* Fullscreen overlay controls */}
        {isFullscreen && (
          <div className="absolute top-4 right-4 z-10">
            <Button
              variant="secondary"
              size="sm"
              onClick={toggleFullscreen}
              className="bg-white/90 hover:bg-white shadow-lg"
            >
              <Minimize2 className="size-4 mr-2" />
              Exit Fullscreen
            </Button>
          </div>
        )}
      </div>

      {/* Mobile-specific styles */}
      <style jsx>{`
        @media (max-width: 768px) {
          .mobile-optimized {
            font-size: 14px;
          }
          .mobile-optimized .controls-bar {
            padding: 8px;
            flex-wrap: wrap;
            gap: 8px;
          }
          .mobile-optimized .control-button {
            min-width: 44px;
            min-height: 44px;
            padding: 8px;
          }
        }

        @media (max-width: 480px) {
          .mobile-optimized .device-selector {
            flex-direction: column;
            gap: 4px;
          }
          .mobile-optimized .viewport-info {
            font-size: 10px;
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Hook for responsive behavior detection
 */
export function useResponsiveDetection() {
  const [deviceType, setDeviceType] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  const [isLandscape, setIsLandscape] = useState(true);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    const detectDevice = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      // Detect device type
      if (width < 768) {
        setDeviceType('mobile');
      } else if (width < 1024) {
        setDeviceType('tablet');
      } else {
        setDeviceType('desktop');
      }

      // Detect orientation
      setIsLandscape(width > height);

      // Detect touch capability
      setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
    };

    detectDevice();
    window.addEventListener('resize', detectDevice);
    window.addEventListener('orientationchange', detectDevice);

    return () => {
      window.removeEventListener('resize', detectDevice);
      window.removeEventListener('orientationchange', detectDevice);
    };
  }, []);

  return {
    deviceType,
    isLandscape,
    isTouchDevice,
    isMobile: deviceType === 'mobile',
    isTablet: deviceType === 'tablet',
    isDesktop: deviceType === 'desktop'
  };
}

/**
 * Touch-friendly interaction helpers
 */
export const touchHelpers = {
  // Convert mouse events to touch events for better mobile compatibility
  getTouchPosition: (event: React.TouchEvent | TouchEvent): { x: number; y: number } => {
    const touch = event.touches[0] || event.changedTouches[0];
    return {
      x: touch.clientX,
      y: touch.clientY
    };
  },

  // Debounce rapid touch events
  debounceTouch: (callback: () => void, delay: number = 300) => {
    let timeoutId: NodeJS.Timeout;
    return () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(callback, delay);
    };
  },

  // Handle swipe gestures
  handleSwipe: (
    startTouch: { x: number; y: number },
    endTouch: { x: number; y: number },
    threshold: number = 50
  ): 'left' | 'right' | 'up' | 'down' | null => {
    const deltaX = endTouch.x - startTouch.x;
    const deltaY = endTouch.y - startTouch.y;
    
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      if (Math.abs(deltaX) > threshold) {
        return deltaX > 0 ? 'right' : 'left';
      }
    } else {
      if (Math.abs(deltaY) > threshold) {
        return deltaY > 0 ? 'down' : 'up';
      }
    }
    
    return null;
  }
};

/**
 * CSS classes for responsive design
 */
export const responsiveClasses = {
  // Container classes
  container: "w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8",
  
  // Grid systems
  gridResponsive: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4",
  
  // Text sizing
  textResponsive: "text-sm sm:text-base lg:text-lg",
  
  // Button sizing
  buttonResponsive: "px-3 py-2 sm:px-4 sm:py-2 lg:px-6 lg:py-3",
  
  // Spacing
  spacingResponsive: "space-y-4 sm:space-y-6 lg:space-y-8",
  
  // Touch targets (minimum 44px for mobile)
  touchTarget: "min-h-[44px] min-w-[44px] touch-manipulation",
  
  // Mobile-first visibility
  hiddenOnMobile: "hidden sm:block",
  visibleOnMobile: "block sm:hidden",
  
  // Mobile optimized controls
  mobileControls: "flex flex-col sm:flex-row gap-2 sm:gap-4 p-4 sm:p-6"
};