'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import {
  Play,
  Pause,
  Square,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Download,
  Share,
  MousePointer,
  Keyboard,
  Eye,
  AlertTriangle,
  Network,
  Activity,
  FastForward,
  Rewind
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface SessionEvent {
  id: string;
  type: 'click' | 'input' | 'navigation' | 'error' | 'network' | 'scroll' | 'resize' | 'focus' | 'blur';
  timestamp: number;
  data: unknown;
  elementPath?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

interface CinematicReplayControlsProps {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  speed: number;
  volume: number;
  isMuted: boolean;
  isFullscreen: boolean;
  events: SessionEvent[];
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSeek: (time: number) => void;
  onSpeedChange: (speed: number) => void;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
  onFullscreenToggle: () => void;
  onSkipToEvent: (eventId: string) => void;
  onExport: () => void;
  onShare: () => void;
  className?: string;
}

export function CinematicReplayControls({
  currentTime,
  duration,
  isPlaying,
  speed,
  volume,
  isMuted,
  isFullscreen,
  events,
  onPlay,
  onPause,
  onStop,
  onSeek,
  onSpeedChange,
  onVolumeChange,
  onMuteToggle,
  onFullscreenToggle,
  onSkipToEvent,
  onExport,
  onShare,
  className
}: CinematicReplayControlsProps) {
  const [showControls, setShowControls] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const controlsRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const hideControlsTimer = useRef<NodeJS.Timeout | null>(null);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Auto-hide controls after inactivity
  const resetHideTimer = useCallback(() => {
    if (hideControlsTimer.current) {
      clearTimeout(hideControlsTimer.current);
    }
    setShowControls(true);
    hideControlsTimer.current = setTimeout(() => {
      if (isPlaying && !isDragging) {
        setShowControls(false);
      }
    }, 3000);
  }, [isPlaying, isDragging]);

  useEffect(() => {
    resetHideTimer();
    return () => {
      if (hideControlsTimer.current) {
        clearTimeout(hideControlsTimer.current);
      }
    };
  }, [resetHideTimer]);

  // Format time display
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const hours = Math.floor(minutes / 60);
    const displayMinutes = minutes % 60;
    
    if (hours > 0) {
      return `${hours}:${displayMinutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${displayMinutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Handle progress bar click and drag
  const handleProgressInteraction = (clientX: number) => {
    const progressBar = progressRef.current;
    if (!progressBar) return;

    const rect = progressBar.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const newTime = (percentage / 100) * duration;
    onSeek(newTime);
  };

  const handleProgressClick = (e: React.MouseEvent) => {
    handleProgressInteraction(e.clientX);
  };

  const handleProgressMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleProgressInteraction(e.clientX);

    const handleMouseMove = (e: MouseEvent) => {
      handleProgressInteraction(e.clientX);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Get event icon and color
  const getEventIcon = (type: string) => {
    switch (type) {
      case 'click': return MousePointer;
      case 'input': return Keyboard;
      case 'navigation': return Eye;
      case 'error': return AlertTriangle;
      case 'network': return Network;
      case 'scroll': return Activity;
      default: return MousePointer;
    }
  };

  const getEventColor = (type: string, severity?: string) => {
    if (type === 'error') {
      switch (severity) {
        case 'critical': return 'bg-red-600';
        case 'high': return 'bg-red-500';
        case 'medium': return 'bg-orange-500';
        default: return 'bg-yellow-500';
      }
    }
    switch (type) {
      case 'click': return 'bg-blue-500';
      case 'input': return 'bg-green-500';
      case 'navigation': return 'bg-purple-500';
      case 'network': return 'bg-orange-500';
      case 'scroll': return 'bg-gray-500';
      default: return 'bg-blue-500';
    }
  };

  // Skip functions
  const skipToNextEvent = () => {
    const nextEvent = events.find(event => event.timestamp > currentTime);
    if (nextEvent) {
      onSeek(nextEvent.timestamp);
    }
  };

  const skipToPrevEvent = () => {
    const prevEvents = events.filter(event => event.timestamp < currentTime);
    const prevEvent = prevEvents[prevEvents.length - 1];
    if (prevEvent) {
      onSeek(prevEvent.timestamp);
    }
  };

  const skip10Forward = () => onSeek(Math.min(duration, currentTime + 10000));
  const skip10Backward = () => onSeek(Math.max(0, currentTime - 10000));

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          isPlaying ? onPause() : onPlay();
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (e.shiftKey) {
            skipToNextEvent();
          } else {
            skip10Forward();
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (e.shiftKey) {
            skipToPrevEvent();
          } else {
            skip10Backward();
          }
          break;
        case 'KeyF':
          e.preventDefault();
          onFullscreenToggle();
          break;
        case 'KeyM':
          e.preventDefault();
          onMuteToggle();
          break;
        case 'Escape':
          if (isFullscreen) {
            onFullscreenToggle();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [isPlaying, currentTime, isFullscreen]);

  return (
    <div 
      className="relative"
      onMouseMove={resetHideTimer}
      onMouseEnter={() => setShowControls(true)}
    >
      {/* Main Progress Bar */}
      <div className="relative mb-2">
        <div 
          ref={progressRef}
          className="h-2 bg-gray-800 bg-opacity-30 rounded-full cursor-pointer relative group hover:h-3 transition-all duration-200"
          onClick={handleProgressClick}
          onMouseDown={handleProgressMouseDown}
        >
          {/* Buffered/Loaded Progress */}
          <div 
            className="absolute top-0 left-0 h-full bg-gray-600 bg-opacity-50 rounded-full"
            style={{ width: '100%' }} // Assuming fully loaded for now
          />
          
          {/* Play Progress */}
          <div 
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
          
          {/* Progress Thumb */}
          <div 
            className="absolute top-1/2 transform -translate-y-1/2 w-4 h-4 bg-white border-2 border-blue-500 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            style={{ left: `${progress}%`, marginLeft: '-8px' }}
          />

          {/* Event Markers */}
          <TooltipProvider>
            {events.map((event) => {
              const eventProgress = duration > 0 ? (event.timestamp / duration) * 100 : 0;
              const EventIcon = getEventIcon(event.type);
              
              return (
                <Tooltip key={event.id}>
                  <TooltipTrigger asChild>
                    <div
                      className="absolute top-1/2 transform -translate-y-1/2 cursor-pointer z-10"
                      style={{ left: `${eventProgress}%`, marginLeft: '-6px' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSkipToEvent(event.id);
                      }}
                    >
                      <div className={`w-3 h-6 ${getEventColor(event.type, event.severity)} rounded-sm border border-white shadow-sm hover:scale-110 transition-transform`} />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-black text-white text-xs">
                    <div className="flex items-center gap-1">
                      <EventIcon className="w-3 h-3" />
                      <span className="capitalize">{event.type}</span>
                      <span>• {formatTime(event.timestamp)}</span>
                    </div>
                    {event.elementPath && (
                      <div className="text-gray-300 text-xs mt-1">{event.elementPath}</div>
                    )}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </TooltipProvider>
        </div>
      </div>

      {/* Control Bar */}
      <div 
        ref={controlsRef}
        className={`bg-gradient-to-r from-gray-900 to-black text-white rounded-lg p-4 transition-all duration-300 ${
          showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
        } ${className}`}
      >
        <div className="flex items-center justify-between">
          {/* Left Controls */}
          <div className="flex items-center gap-3">
            {/* Time Display */}
            <div className="text-sm font-mono text-gray-300 min-w-[100px]">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>

            {/* Playback Controls */}
            <div className="flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-white hover:bg-white hover:bg-opacity-20"
                      onClick={skipToPrevEvent}
                    >
                      <SkipBack className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Previous Event (Shift + ←)</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-white hover:bg-white hover:bg-opacity-20"
                      onClick={skip10Backward}
                    >
                      <Rewind className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>-10s (←)</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="lg"
                      className="bg-blue-600 hover:bg-blue-500 text-white"
                      onClick={isPlaying ? onPause : onPlay}
                    >
                      {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Play/Pause (Space)</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-white hover:bg-white hover:bg-opacity-20"
                      onClick={skip10Forward}
                    >
                      <FastForward className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>+10s (→)</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-white hover:bg-white hover:bg-opacity-20"
                      onClick={skipToNextEvent}
                    >
                      <SkipForward className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Next Event (Shift + →)</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-white hover:bg-white hover:bg-opacity-20"
                      onClick={onStop}
                    >
                      <Square className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Stop</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* Center Controls */}
          <div className="flex items-center gap-4">
            {/* Speed Control */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-300">Speed:</span>
              <Select value={speed.toString()} onValueChange={(value) => onSpeedChange(parseFloat(value))}>
                <SelectTrigger className="w-20 bg-gray-800 border-gray-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600">
                  <SelectItem value="0.25" className="text-white hover:bg-gray-700">0.25x</SelectItem>
                  <SelectItem value="0.5" className="text-white hover:bg-gray-700">0.5x</SelectItem>
                  <SelectItem value="0.75" className="text-white hover:bg-gray-700">0.75x</SelectItem>
                  <SelectItem value="1" className="text-white hover:bg-gray-700">1x</SelectItem>
                  <SelectItem value="1.25" className="text-white hover:bg-gray-700">1.25x</SelectItem>
                  <SelectItem value="1.5" className="text-white hover:bg-gray-700">1.5x</SelectItem>
                  <SelectItem value="2" className="text-white hover:bg-gray-700">2x</SelectItem>
                  <SelectItem value="4" className="text-white hover:bg-gray-700">4x</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Session Stats */}
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="text-gray-300 border-gray-600">
                {events.length} events
              </Badge>
              <Badge 
                variant="outline" 
                className={`${events.some(e => e.type === 'error') ? 'text-red-400 border-red-600' : 'text-green-400 border-green-600'}`}
              >
                {events.filter(e => e.type === 'error').length} errors
              </Badge>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2">
            {/* Volume Control */}
            <div className="flex items-center gap-2 relative">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-white hover:bg-white hover:bg-opacity-20"
                      onClick={onMuteToggle}
                      onMouseEnter={() => setShowVolumeSlider(true)}
                    >
                      {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Mute/Unmute (M)</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              {showVolumeSlider && (
                <div 
                  className="absolute bottom-full mb-2 bg-gray-800 p-2 rounded shadow-lg"
                  onMouseLeave={() => setShowVolumeSlider(false)}
                >
                  <Slider
                    value={[isMuted ? 0 : volume]}
                    onValueChange={([value]) => onVolumeChange(value)}
                    max={1}
                    step={0.1}
                    orientation="vertical"
                    className="h-16 w-4"
                  />
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-white hover:bg-white hover:bg-opacity-20"
                    onClick={onExport}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Export Session</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-white hover:bg-white hover:bg-opacity-20"
                    onClick={onShare}
                  >
                    <Share className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Share Session</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-white hover:bg-white hover:bg-opacity-20"
                    onClick={onFullscreenToggle}
                  >
                    {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Fullscreen (F)</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Help */}
      <div className={`absolute bottom-full mb-2 right-0 bg-black bg-opacity-90 text-white text-xs p-3 rounded max-w-xs transition-opacity duration-200 ${
        showControls ? 'opacity-0' : 'opacity-100'
      }`}>
        <div className="grid grid-cols-2 gap-2">
          <div>Space: Play/Pause</div>
          <div>F: Fullscreen</div>
          <div>←/→: Skip 10s</div>
          <div>M: Mute</div>
          <div>Shift+←/→: Events</div>
          <div>Esc: Exit</div>
        </div>
      </div>
    </div>
  );
}