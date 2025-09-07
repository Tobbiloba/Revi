'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  Settings,
  Download,
  Share,
  Clock,
  MousePointer,
  Keyboard,
  Mouse,
  Eye,
  AlertTriangle,
  Zap,
  StepForward
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SessionEvent {
  id: string;
  type: 'click' | 'input' | 'navigation' | 'error' | 'network' | 'scroll' | 'resize';
  timestamp: number;
  data: unknown;
  elementPath?: string;
}

interface SessionReplayData {
  sessionId: string;
  userId: string;
  startTime: Date;
  endTime: Date;
  events: SessionEvent[];
  errors: Array<{
    id: string;
    timestamp: number;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
  metadata: {
    userAgent: string;
    viewport: { width: number; height: number };
    url: string;
  };
}

interface AdvancedSessionReplayProps {
  sessionData: SessionReplayData;
  onEventClick?: (event: SessionEvent) => void;
  className?: string;
}

export function AdvancedSessionReplay({ sessionData, onEventClick, className }: AdvancedSessionReplayProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [skipInactivity, setSkipInactivity] = useState(true);
  const [showEventMarkers, setShowEventMarkers] = useState(true);
  
  const videoRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  
  const totalDuration = sessionData.endTime.getTime() - sessionData.startTime.getTime();
  const progress = (currentTime / totalDuration) * 100;

  // Playback control functions
  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
  };

  const handleSeek = (position: number) => {
    setCurrentTime((position / 100) * totalDuration);
  };

  const skipToNextEvent = () => {
    const nextEvent = sessionData.events.find(event => 
      event.timestamp > sessionData.startTime.getTime() + currentTime
    );
    if (nextEvent) {
      setCurrentTime(nextEvent.timestamp - sessionData.startTime.getTime());
    }
  };

  const skipToPrevEvent = () => {
    const prevEvents = sessionData.events.filter(event => 
      event.timestamp < sessionData.startTime.getTime() + currentTime
    );
    const prevEvent = prevEvents[prevEvents.length - 1];
    if (prevEvent) {
      setCurrentTime(prevEvent.timestamp - sessionData.startTime.getTime());
    }
  };

  const jumpToError = (errorTimestamp: number) => {
    setCurrentTime(errorTimestamp - sessionData.startTime.getTime());
  };

  const formatTime = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'click': return MousePointer;
      case 'input': return Keyboard;
      case 'navigation': return Eye;
      case 'error': return AlertTriangle;
      case 'network': return Zap;
      case 'scroll': return Mouse;
      default: return MousePointer;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'click': return 'bg-blue-500';
      case 'input': return 'bg-green-500';
      case 'navigation': return 'bg-purple-500';
      case 'error': return 'bg-red-500';
      case 'network': return 'bg-orange-500';
      case 'scroll': return 'bg-gray-500';
      default: return 'bg-blue-500';
    }
  };

  // Simulate playback
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime(prev => {
          const next = prev + (100 * playbackSpeed);
          if (next >= totalDuration) {
            setIsPlaying(false);
            return totalDuration;
          }
          return next;
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, totalDuration]);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Session Info Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Eye className="size-5 text-blue-600" />
                Session Replay
              </CardTitle>
              <CardDescription>
                Session ID: {sessionData.sessionId} • User: {sessionData.userId}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {formatTime(totalDuration)} duration
              </Badge>
              <Badge variant="outline">
                {sessionData.events.length} events
              </Badge>
              <Badge variant={sessionData.errors.length > 0 ? 'destructive' : 'secondary'}>
                {sessionData.errors.length} errors
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Replay Interface */}
      <Card className={cn(isFullscreen && "fixed inset-0 z-50 rounded-none")}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                {formatTime(currentTime)} / {formatTime(totalDuration)}
              </div>
              <Badge variant="outline">
                {playbackSpeed}x speed
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setIsFullscreen(!isFullscreen)}>
                {isFullscreen ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
              </Button>
              <Button size="sm" variant="outline">
                <Download className="size-4" />
              </Button>
              <Button size="sm" variant="outline">
                <Share className="size-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Video/Replay Area */}
          <div 
            ref={videoRef}
            className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden mb-4 cursor-pointer"
            onClick={togglePlayPause}
          >
            {/* Simulated browser viewport */}
            <div className="absolute inset-0 bg-white m-4 rounded">
              <div className="h-8 bg-gray-100 rounded-t flex items-center px-4 text-xs text-gray-600">
                {sessionData.metadata.url}
              </div>
              <div className="p-4 flex items-center justify-center h-full bg-gray-50">
                <div className="text-center">
                  <div className="text-4xl mb-2">
                    {isPlaying ? '▶️' : '⏸️'}
                  </div>
                  <p className="text-sm text-gray-600">
                    Simulated session replay - {formatTime(currentTime)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {sessionData.metadata.viewport.width}x{sessionData.metadata.viewport.height}
                  </p>
                </div>
              </div>
            </div>

            {/* Play/Pause Overlay */}
            {!isPlaying && (
              <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
                <div className="bg-white bg-opacity-90 rounded-full p-4">
                  <Play className="size-8 text-gray-800" />
                </div>
              </div>
            )}
          </div>

          {/* Timeline with Event Markers */}
          <div className="relative mb-4">
            {/* Progress Bar */}
            <div 
              ref={progressRef}
              className="h-2 bg-gray-200 rounded-full cursor-pointer relative"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const position = ((e.clientX - rect.left) / rect.width) * 100;
                handleSeek(position);
              }}
            >
              <div 
                className="h-full bg-blue-500 rounded-full transition-all duration-100"
                style={{ width: `${progress}%` }}
              />
              
              {/* Current Time Indicator */}
              <div 
                className="absolute top-1/2 transform -translate-y-1/2 w-4 h-4 bg-blue-500 border-2 border-white rounded-full shadow-sm"
                style={{ left: `${progress}%` }}
              />

              {/* Event Markers */}
              {showEventMarkers && sessionData.events.map((event) => {
                const eventProgress = ((event.timestamp - sessionData.startTime.getTime()) / totalDuration) * 100;
                const EventIcon = getEventIcon(event.type);
                
                return (
                  <div
                    key={event.id}
                    className="absolute top-1/2 transform -translate-y-1/2 cursor-pointer group"
                    style={{ left: `${eventProgress}%` }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentTime(event.timestamp - sessionData.startTime.getTime());
                      onEventClick?.(event);
                    }}
                  >
                    <div className={cn(
                      "w-2 h-6 rounded-sm",
                      getEventColor(event.type)
                    )} />
                    
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="bg-black text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                        <EventIcon className="size-3 inline mr-1" />
                        {event.type} • {formatTime(event.timestamp - sessionData.startTime.getTime())}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Error Markers */}
              {sessionData.errors.map((error) => {
                const errorProgress = ((error.timestamp - sessionData.startTime.getTime()) / totalDuration) * 100;
                
                return (
                  <div
                    key={error.id}
                    className="absolute top-1/2 transform -translate-y-1/2 cursor-pointer"
                    style={{ left: `${errorProgress}%` }}
                    onClick={() => jumpToError(error.timestamp)}
                  >
                    <div className="w-3 h-8 bg-red-500 rounded-sm border-2 border-white shadow-sm" />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Control Panel */}
          <div className="flex items-center justify-between">
            {/* Left Controls */}
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={skipToPrevEvent}>
                <SkipBack className="size-4" />
              </Button>
              
              <Button size="sm" variant="outline" onClick={() => handleSeek(Math.max(0, progress - 5))}>
                <SkipBack className="size-4" />
              </Button>

              <Button onClick={togglePlayPause} size="sm">
                {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
              </Button>

              <Button size="sm" variant="outline" onClick={() => handleSeek(Math.min(100, progress + 5))}>
                <StepForward className="size-4" />
              </Button>

              <Button size="sm" variant="outline" onClick={skipToNextEvent}>
                <SkipForward className="size-4" />
              </Button>

              <Button size="sm" variant="outline" onClick={() => setIsPlaying(false)}>
                <Square className="size-4" />
              </Button>
            </div>

            {/* Center Controls */}
            <div className="flex items-center gap-4">
              {/* Playback Speed */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground">Speed:</label>
                <Select value={playbackSpeed.toString()} onValueChange={(value) => handleSpeedChange(parseFloat(value))}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0.25">0.25x</SelectItem>
                    <SelectItem value="0.5">0.5x</SelectItem>
                    <SelectItem value="0.75">0.75x</SelectItem>
                    <SelectItem value="1">1x</SelectItem>
                    <SelectItem value="1.25">1.25x</SelectItem>
                    <SelectItem value="1.5">1.5x</SelectItem>
                    <SelectItem value="2">2x</SelectItem>
                    <SelectItem value="4">4x</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Skip Inactivity */}
              <Button 
                size="sm" 
                variant={skipInactivity ? "default" : "outline"}
                onClick={() => setSkipInactivity(!skipInactivity)}
              >
                <Zap className="size-4 mr-1" />
                Skip Idle
              </Button>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-2">
              {/* Volume Control */}
              <div className="flex items-center gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => setIsMuted(!isMuted)}
                >
                  {isMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                </Button>
                <Slider
                  value={[isMuted ? 0 : volume]}
                  onValueChange={([value]) => setVolume(value)}
                  max={1}
                  step={0.1}
                  className="w-16"
                />
              </div>

              <Button size="sm" variant="outline">
                <Settings className="size-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Event Timeline */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="size-5" />
              Event Timeline
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={showEventMarkers ? "default" : "outline"}
                onClick={() => setShowEventMarkers(!showEventMarkers)}
              >
                Show Markers
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {sessionData.events.map((event) => {
              const EventIcon = getEventIcon(event.type);
              const timeFromStart = event.timestamp - sessionData.startTime.getTime();
              
              return (
                <div
                  key={event.id}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer",
                    Math.abs(currentTime - timeFromStart) < 1000 && "bg-blue-50 border border-blue-200"
                  )}
                  onClick={() => {
                    setCurrentTime(timeFromStart);
                    onEventClick?.(event);
                  }}
                >
                  <EventIcon className="size-4 text-gray-600" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{event.type}</div>
                    {event.elementPath && (
                      <div className="text-xs text-muted-foreground">{event.elementPath}</div>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatTime(timeFromStart)}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}