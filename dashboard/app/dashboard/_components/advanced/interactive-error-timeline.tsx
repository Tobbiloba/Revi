'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IconZoomIn, IconZoomOut, IconRefresh, IconDownload, IconSettings } from '@tabler/icons-react';
import { ErrorWithSession } from '@/lib/revi-api';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface TimelineError extends ErrorWithSession {
  x?: number;
  y?: number;
}

interface InteractiveErrorTimelineProps {
  errors: ErrorWithSession[];
  className?: string;
  height?: number;
  onErrorClick?: (error: ErrorWithSession) => void;
  enableZoom?: boolean;
  enableBrushing?: boolean;
}

interface TimeRange {
  label: string;
  value: number; // hours
  format: string;
}

const timeRanges: TimeRange[] = [
  { label: '1 Hour', value: 1, format: '%H:%M' },
  { label: '6 Hours', value: 6, format: '%H:%M' },
  { label: '24 Hours', value: 24, format: '%m/%d %H:%M' },
  { label: '7 Days', value: 168, format: '%m/%d' },
  { label: '30 Days', value: 720, format: '%m/%d' }
];

const severityColors = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#ca8a04',
  low: '#2563eb'
};

export const InteractiveErrorTimeline: React.FC<InteractiveErrorTimelineProps> = ({
  errors,
  className,
  height = 400,
  onErrorClick,
  enableZoom = true,
  enableBrushing = true
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>(timeRanges[1]);
  const [hoveredError, setHoveredError] = useState<TimelineError | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [zoomLevel, setZoomLevel] = useState(1);

  // Filter errors based on selected time range
  const filteredErrors = useMemo(() => {
    const now = Date.now();
    const cutoff = now - (selectedTimeRange.value * 60 * 60 * 1000);
    
    return errors
      .filter(error => new Date(error.timestamp).getTime() > cutoff)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [errors, selectedTimeRange]);

  // Group errors for better visualization
  const groupedErrors = useMemo(() => {
    const groups: { [key: string]: TimelineError[] } = {};
    
    filteredErrors.forEach(error => {
      const timeKey = Math.floor(new Date(error.timestamp).getTime() / (5 * 60 * 1000)) * (5 * 60 * 1000);
      const key = `${timeKey}-${error.severity}`;
      
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(error as TimelineError);
    });

    return Object.values(groups).map(group => ({
      timestamp: group[0].timestamp,
      severity: group[0].severity || 'medium',
      errors: group,
      count: group.length
    }));
  }, [filteredErrors]);

  const drawTimeline = useCallback(() => {
    const svg = d3.select(svgRef.current);
    const container = containerRef.current;
    
    if (!svg.node() || !container || groupedErrors.length === 0) return;

    // Clear previous content
    svg.selectAll('*').remove();

    const margin = { top: 20, right: 30, bottom: 40, left: 50 };
    const width = container.clientWidth - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Create main group
    const g = svg
      .attr('width', container.clientWidth)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create scales
    const timeExtent = d3.extent(groupedErrors, d => new Date(d.timestamp)) as [Date, Date];
    const xScale = d3.scaleTime()
      .domain(timeExtent)
      .range([0, width]);

    const maxCount = d3.max(groupedErrors, d => d.count) || 1;
    const yScale = d3.scaleLinear()
      .domain([0, maxCount])
      .range([innerHeight, 0]);

    // Create zoom behavior
    const zoom = d3.zoom<SVGGElement, unknown>()
      .scaleExtent([1, 10])
      .on('zoom', (event) => {
        const { transform } = event;
        setZoomLevel(transform.k);
        
        // Update scales with zoom transform
        const newXScale = transform.rescaleX(xScale);
        
        // Update axes
        g.select<SVGGElement>('.x-axis')
          .call(d3.axisBottom(newXScale).tickFormat((d) => d3.timeFormat(selectedTimeRange.format)(new Date(d as number))));
        
        // Update circles
        g.selectAll('.error-point')
          .attr('cx', (d: unknown) => newXScale(new Date((d as typeof groupedErrors[0]).timestamp)));
        
        // Update area chart if exists  
        const newAreaGenerator = d3.area<typeof groupedErrors[0]>()
          .x(d => newXScale(new Date(d.timestamp)))
          .y0(innerHeight)
          .y1(d => yScale(d.count))
          .curve(d3.curveMonotoneX);
          
        g.select('.area-path')
          .attr('d', newAreaGenerator(groupedErrors));
      });

    if (enableZoom) {
      g.call(zoom);
    }

    // Add background area chart
    const areaGenerator = d3.area<typeof groupedErrors[0]>()
      .x(d => xScale(new Date(d.timestamp)))
      .y0(innerHeight)
      .y1(d => yScale(d.count))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(groupedErrors)
      .attr('class', 'area-path')
      .attr('d', areaGenerator(groupedErrors))
      .attr('fill', 'rgba(59, 130, 246, 0.1)')
      .attr('stroke', 'rgba(59, 130, 246, 0.3)')
      .attr('stroke-width', 1);

    // Add X axis
    g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).tickFormat((d) => d3.timeFormat(selectedTimeRange.format)(new Date(d as number))));

    // Add Y axis
    g.append('g')
      .attr('class', 'y-axis')
      .call(d3.axisLeft(yScale).ticks(5));

    // Add Y axis label
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 0 - margin.left)
      .attr('x', 0 - (innerHeight / 2))
      .attr('dy', '1em')
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', '#6b7280')
      .text('Error Count');

    // Add error points
    const points = g.selectAll('.error-point')
      .data(groupedErrors)
      .enter()
      .append('circle')
      .attr('class', 'error-point')
      .attr('cx', d => xScale(new Date(d.timestamp)))
      .attr('cy', d => yScale(d.count))
      .attr('r', d => Math.max(3, Math.min(8, Math.sqrt(d.count) * 2)))
      .attr('fill', d => severityColors[d.severity as keyof typeof severityColors])
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .style('opacity', 0.8);

    // Add hover interactions
    points
      .on('mouseover', (event, d) => {
        const [mouseX, mouseY] = d3.pointer(event, container);
        setHoveredError(d.errors[0] as TimelineError);
        setMousePosition({ x: mouseX, y: mouseY });
        
        d3.select(event.currentTarget)
          .style('opacity', 1)
          .attr('stroke-width', 3);
      })
      .on('mouseout', (event) => {
        setHoveredError(null);
        
        d3.select(event.currentTarget)
          .style('opacity', 0.8)
          .attr('stroke-width', 2);
      })
      .on('click', (event, d) => {
        if (onErrorClick && d.errors.length > 0) {
          onErrorClick(d.errors[0]);
        }
      });

    // Add brushing for time range selection
    if (enableBrushing) {
      const brush = d3.brushX()
        .extent([[0, 0], [width, innerHeight]])
        .on('end', (event) => {
          const selection = event.selection;
          if (selection) {
            const [x0, x1] = selection;
            // Here you could emit an event or call a callback with the selected time range
            // const domain = [xScale.invert(x0), xScale.invert(x1)];
            console.log('Time range selected:', xScale.invert(x0), 'to', xScale.invert(x1));
          }
        });

      g.append('g')
        .attr('class', 'brush')
        .call(brush);
    }

  }, [groupedErrors, selectedTimeRange, height, enableZoom, enableBrushing, onErrorClick]);

  // Redraw when data or settings change
  useEffect(() => {
    drawTimeline();
  }, [drawTimeline]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      drawTimeline();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawTimeline]);

  const handleZoomIn = () => {
    const svg = d3.select(svgRef.current);
    const g = svg.select('g');
    const zoom = d3.zoom<SVGGElement, unknown>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (g as any).call(zoom.scaleBy, 1.5);
  };

  const handleZoomOut = () => {
    const svg = d3.select(svgRef.current);
    const g = svg.select('g');
    const zoom = d3.zoom<SVGGElement, unknown>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (g as any).call(zoom.scaleBy, 1 / 1.5);
  };

  const handleReset = () => {
    const svg = d3.select(svgRef.current);
    const g = svg.select('g');
    const zoom = d3.zoom<SVGGElement, unknown>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (g as any).call(zoom.transform, d3.zoomIdentity);
    setZoomLevel(1);
  };

  const exportTimeline = () => {
    const svg = svgRef.current;
    if (!svg) return;

    const serializer = new XMLSerializer();
    const svgData = serializer.serializeToString(svg);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `error-timeline-${new Date().toISOString().split('T')[0]}.svg`;
    link.click();
    
    URL.revokeObjectURL(url);
  };

  return (
    <div className={cn("flex flex-col", className)}>
      <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-3 text-xl font-normal">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <IconSettings className="size-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="text-gray-800 dark:text-gray-200">Interactive Error Timeline</span>
                <Badge variant="secondary" className="ml-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-0 font-light">
                  {filteredErrors.length} errors
                </Badge>
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400 text-base font-light mt-2">
                Zoomable timeline with correlation analysis and anomaly detection
              </CardDescription>
            </div>
            
            <div className="flex items-center gap-2">
              <Select value={selectedTimeRange.label} onValueChange={(value) => {
                const range = timeRanges.find(r => r.label === value);
                if (range) setSelectedTimeRange(range);
              }}>
                <SelectTrigger className="w-32 h-8 bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-gray-200 dark:border-gray-700 font-light">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timeRanges.map(range => (
                    <SelectItem key={range.label} value={range.label}>
                      {range.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {enableZoom && (
                <>
                  <Button variant="outline" size="sm" onClick={handleZoomIn} className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors font-normal">
                    <IconZoomIn className="size-4 text-blue-600 dark:text-blue-400" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleZoomOut} className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors font-normal">
                    <IconZoomOut className="size-4 text-blue-600 dark:text-blue-400" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleReset} className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-gray-200 dark:border-gray-700 hover:bg-yellow-50 dark:hover:bg-yellow-950/20 transition-colors font-normal">
                    <IconRefresh className="size-4 text-yellow-600 dark:text-yellow-400" />
                  </Button>
                </>
              )}
              
              <Button variant="outline" size="sm" onClick={exportTimeline} className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-gray-200 dark:border-gray-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors font-normal">
                <IconDownload className="size-4 text-emerald-600 dark:text-emerald-400" />
              </Button>
            </div>
          </div>
          
          {zoomLevel > 1 && (
            <div className="flex items-center gap-2 mt-3">
              <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-0 font-light">
                Zoom: {zoomLevel.toFixed(1)}x
              </Badge>
              <span className="text-sm text-gray-600 dark:text-gray-400 font-light">
                Drag to pan, scroll to zoom
              </span>
            </div>
          )}
        </CardHeader>
        
        <CardContent>
          <div className="relative" ref={containerRef}>
            <svg ref={svgRef} className="w-full" />
            
            {hoveredError && (
              <div 
                className="absolute bg-black text-white p-3 rounded-lg shadow-lg pointer-events-none z-10 max-w-sm"
                style={{ 
                  left: mousePosition.x + 10, 
                  top: mousePosition.y - 10,
                  transform: 'translateY(-100%)'
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Badge 
                    variant="secondary" 
                    className={`text-white border-0 font-light`}
                    style={{ backgroundColor: severityColors[hoveredError.severity as keyof typeof severityColors] }}
                  >
                    {hoveredError.severity?.toUpperCase()}
                  </Badge>
                  <span className="text-xs font-light">
                    {formatDistanceToNow(new Date(hoveredError.timestamp), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm font-light text-white">
                  {hoveredError.message.substring(0, 100)}
                  {hoveredError.message.length > 100 && '...'}
                </p>
                {hoveredError.url && (
                  <p className="text-xs text-gray-300 mt-1 font-light">
                    {hoveredError.url}
                  </p>
                )}
              </div>
            )}
          </div>
          
          {groupedErrors.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <IconSettings className="size-12 text-gray-400 dark:text-gray-500 mb-4" />
              <h3 className="text-lg font-normal mb-2 text-gray-800 dark:text-gray-200">No data in selected time range</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-light">
                Try selecting a different time range or check if errors are being captured.
              </p>
            </div>
          )}
          
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600 dark:text-gray-400 font-light">
                Severity Legend:
              </div>
              {Object.entries(severityColors).map(([severity, color]) => (
                <div key={severity} className="flex items-center gap-2">
                  <div 
                    className="size-3 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs capitalize text-gray-700 dark:text-gray-300 font-light">{severity}</span>
                </div>
              ))}
            </div>
            
            <div className="text-xs text-gray-600 dark:text-gray-400 font-light">
              Click points to view details • Drag to select time range
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};