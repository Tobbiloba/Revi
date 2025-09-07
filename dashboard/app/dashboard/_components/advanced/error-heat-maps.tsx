'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IconChartDots, IconClock, IconMapPin, IconBrowser, IconDevices, IconDownload } from '@tabler/icons-react';
import { ErrorWithSession } from '@/lib/revi-api';
import { cn } from '@/lib/utils';

interface ErrorHeatMapsProps {
  errors: ErrorWithSession[];
  className?: string;
  height?: number;
}

interface HeatMapData {
  x: string;
  y: string;
  value: number;
  errors: ErrorWithSession[];
}

interface TimeHeatMapData {
  hour: number;
  day: number;
  value: number;
  errors: ErrorWithSession[];
}

interface LocationHeatMapData {
  url: string;
  fullUrl: string;
  count: number;
  severity: string;
  errors: ErrorWithSession[];
}

const severityColors = {
  critical: '#dc2626',
  high: '#ea580c', 
  medium: '#ca8a04',
  low: '#2563eb'
};

const getContrastColor = (hexColor: string): string => {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
};

export const ErrorHeatMaps: React.FC<ErrorHeatMapsProps> = ({
  errors,
  className,
  height = 400
}) => {
  const timeHeatMapRef = useRef<SVGSVGElement>(null);
  const locationHeatMapRef = useRef<SVGSVGElement>(null);
  const browserHeatMapRef = useRef<SVGSVGElement>(null);
  const [hoveredCell, setHoveredCell] = useState<{
    type: 'time' | 'location' | 'browser';
    data: HeatMapData | TimeHeatMapData | LocationHeatMapData;
  } | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');

  // Filter errors based on time range
  const filteredErrors = useMemo(() => {
    const now = Date.now();
    let cutoff = now;
    
    switch (selectedTimeRange) {
      case '1h':
        cutoff = now - (1 * 60 * 60 * 1000);
        break;
      case '6h':
        cutoff = now - (6 * 60 * 60 * 1000);
        break;
      case '24h':
        cutoff = now - (24 * 60 * 60 * 1000);
        break;
      case '7d':
        cutoff = now - (7 * 24 * 60 * 60 * 1000);
        break;
      default:
        cutoff = 0;
    }
    
    return errors.filter(error => new Date(error.timestamp).getTime() > cutoff);
  }, [errors, selectedTimeRange]);

  // Prepare time heat map data (hour vs day of week)
  const timeHeatMapData = useMemo(() => {
    const heatMapData: TimeHeatMapData[] = [];
    const dataMap = new Map<string, { count: number; errors: ErrorWithSession[] }>();

    filteredErrors.forEach(error => {
      const date = new Date(error.timestamp);
      const hour = date.getHours();
      const day = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const key = `${day}-${hour}`;
      
      if (!dataMap.has(key)) {
        dataMap.set(key, { count: 0, errors: [] });
      }
      
      const existing = dataMap.get(key)!;
      existing.count++;
      existing.errors.push(error);
    });

    // Generate all hour/day combinations
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const key = `${day}-${hour}`;
        const data = dataMap.get(key) || { count: 0, errors: [] };
        heatMapData.push({
          hour,
          day,
          value: data.count,
          errors: data.errors
        });
      }
    }

    return heatMapData;
  }, [filteredErrors]);

  // Prepare location heat map data
  const locationHeatMapData = useMemo(() => {
    const locationMap = new Map<string, { count: number; errors: ErrorWithSession[]; severityCount: Record<string, number> }>();

    filteredErrors.forEach(error => {
      const url = error.url || 'Unknown';
      const severity = error.severity || 'medium';
      
      if (!locationMap.has(url)) {
        locationMap.set(url, { 
          count: 0, 
          errors: [], 
          severityCount: { critical: 0, high: 0, medium: 0, low: 0 }
        });
      }
      
      const existing = locationMap.get(url)!;
      existing.count++;
      existing.errors.push(error);
      existing.severityCount[severity]++;
    });

    return Array.from(locationMap.entries())
      .map(([url, data]) => {
        const topSeverity = Object.entries(data.severityCount)
          .sort(([,a], [,b]) => b - a)[0][0];
        
        return {
          url: url.length > 50 ? `...${url.slice(-47)}` : url,
          fullUrl: url,
          count: data.count,
          severity: topSeverity,
          errors: data.errors
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 20); // Top 20 pages
  }, [filteredErrors]);

  // Prepare browser/device heat map data
  const browserHeatMapData = useMemo(() => {
    const browserMap = new Map<string, Map<string, { count: number; errors: ErrorWithSession[] }>>();

    filteredErrors.forEach(error => {
      const userAgent = error.user_agent || 'Unknown';
      const browser = extractBrowser(userAgent);
      const os = extractOS(userAgent);
      
      if (!browserMap.has(browser)) {
        browserMap.set(browser, new Map());
      }
      
      const osMap = browserMap.get(browser)!;
      if (!osMap.has(os)) {
        osMap.set(os, { count: 0, errors: [] });
      }
      
      const existing = osMap.get(os)!;
      existing.count++;
      existing.errors.push(error);
    });

    const heatMapData: HeatMapData[] = [];
    browserMap.forEach((osMap, browser) => {
      osMap.forEach((data, os) => {
        heatMapData.push({
          x: browser,
          y: os,
          value: data.count,
          errors: data.errors
        });
      });
    });

    return heatMapData.sort((a, b) => b.value - a.value);
  }, [filteredErrors]);

  const extractBrowser = (userAgent: string): string => {
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    if (userAgent.includes('Opera')) return 'Opera';
    return 'Other';
  };

  const extractOS = (userAgent: string): string => {
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Mac OS')) return 'macOS';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iOS')) return 'iOS';
    return 'Other';
  };

  const drawTimeHeatMap = useCallback(() => {
    const svg = d3.select(timeHeatMapRef.current);
    if (!svg.node()) return;

    svg.selectAll('*').remove();

    const margin = { top: 40, right: 40, bottom: 40, left: 80 };
    const width = svg.node()!.clientWidth || 800;
    const innerHeight = height - margin.top - margin.bottom;

    const cellWidth = (width - margin.left - margin.right) / 24;
    const cellHeight = innerHeight / 7;

    const g = svg
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const maxValue = d3.max(timeHeatMapData, d => d.value) || 1;
    const colorScale = d3.scaleSequential(d3.interpolateReds)
      .domain([0, maxValue]);

    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Add cells
    g.selectAll('.heatmap-cell')
      .data(timeHeatMapData)
      .enter()
      .append('rect')
      .attr('class', 'heatmap-cell')
      .attr('x', d => d.hour * cellWidth)
      .attr('y', d => d.day * cellHeight)
      .attr('width', cellWidth - 1)
      .attr('height', cellHeight - 1)
      .attr('fill', d => d.value === 0 ? '#f3f4f6' : colorScale(d.value))
      .attr('stroke', '#e5e7eb')
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        setHoveredCell({ type: 'time', data: d });
        const [mouseX, mouseY] = d3.pointer(event, svg.node());
        setMousePosition({ x: mouseX, y: mouseY });
        
        d3.select(this).attr('stroke', '#374151').attr('stroke-width', 2);
      })
      .on('mouseout', function() {
        setHoveredCell(null);
        d3.select(this).attr('stroke', '#e5e7eb').attr('stroke-width', 1);
      });

    // Add hour labels (x-axis)
    g.selectAll('.hour-label')
      .data(d3.range(24))
      .enter()
      .append('text')
      .attr('class', 'hour-label')
      .attr('x', d => d * cellWidth + cellWidth / 2)
      .attr('y', -5)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', '#6b7280')
      .text(d => d === 0 ? '12 AM' : d === 12 ? '12 PM' : d < 12 ? `${d} AM` : `${d - 12} PM`);

    // Add day labels (y-axis)
    g.selectAll('.day-label')
      .data(dayLabels)
      .enter()
      .append('text')
      .attr('class', 'day-label')
      .attr('x', -10)
      .attr('y', (d, i) => i * cellHeight + cellHeight / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .style('font-size', '12px')
      .style('fill', '#6b7280')
      .text(d => d);

  }, [timeHeatMapData, height]);

  const drawLocationHeatMap = useCallback(() => {
    const svg = d3.select(locationHeatMapRef.current);
    if (!svg.node() || locationHeatMapData.length === 0) return;

    svg.selectAll('*').remove();

    const margin = { top: 20, right: 40, bottom: 40, left: 200 };
    const width = svg.node()!.clientWidth || 800;
    const innerHeight = height - margin.top - margin.bottom;

    const barHeight = Math.min(25, innerHeight / locationHeatMapData.length);
    const actualHeight = barHeight * locationHeatMapData.length + margin.top + margin.bottom;

    const g = svg
      .attr('width', width)
      .attr('height', actualHeight)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const maxValue = d3.max(locationHeatMapData, d => d.count) || 1;
    const xScale = d3.scaleLinear()
      .domain([0, maxValue])
      .range([0, width - margin.left - margin.right]);

    // Add bars
    g.selectAll('.location-bar')
      .data(locationHeatMapData)
      .enter()
      .append('rect')
      .attr('class', 'location-bar')
      .attr('x', 0)
      .attr('y', (d, i) => i * barHeight + 2)
      .attr('width', d => xScale(d.count))
      .attr('height', barHeight - 4)
      .attr('fill', d => severityColors[d.severity as keyof typeof severityColors])
      .attr('rx', 3)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        setHoveredCell({ type: 'location', data: d });
        const [mouseX, mouseY] = d3.pointer(event, svg.node());
        setMousePosition({ x: mouseX, y: mouseY });
        
        d3.select(this).style('opacity', 0.8);
      })
      .on('mouseout', function() {
        setHoveredCell(null);
        d3.select(this).style('opacity', 1);
      });

    // Add labels
    g.selectAll('.location-label')
      .data(locationHeatMapData)
      .enter()
      .append('text')
      .attr('class', 'location-label')
      .attr('x', -10)
      .attr('y', (d, i) => i * barHeight + barHeight / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .style('font-size', '11px')
      .style('fill', '#374151')
      .text(d => d.url);

    // Add count labels
    g.selectAll('.count-label')
      .data(locationHeatMapData)
      .enter()
      .append('text')
      .attr('class', 'count-label')
      .attr('x', d => xScale(d.count) + 5)
      .attr('y', (d, i) => i * barHeight + barHeight / 2)
      .attr('dominant-baseline', 'middle')
      .style('font-size', '10px')
      .style('fill', '#6b7280')
      .text(d => d.count);

  }, [locationHeatMapData, height]);

  const drawBrowserHeatMap = useCallback(() => {
    const svg = d3.select(browserHeatMapRef.current);
    if (!svg.node() || browserHeatMapData.length === 0) return;

    svg.selectAll('*').remove();

    const margin = { top: 40, right: 40, bottom: 60, left: 80 };
    const width = svg.node()!.clientWidth || 800;
    const innerHeight = height - margin.top - margin.bottom;

    const browsers = Array.from(new Set(browserHeatMapData.map(d => d.x)));
    const operatingSystems = Array.from(new Set(browserHeatMapData.map(d => d.y)));

    const cellWidth = (width - margin.left - margin.right) / browsers.length;
    const cellHeight = innerHeight / operatingSystems.length;

    const g = svg
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const maxValue = d3.max(browserHeatMapData, d => d.value) || 1;
    const colorScale = d3.scaleSequential(d3.interpolateBlues)
      .domain([0, maxValue]);

    // Create cells
    browsers.forEach((browser, i) => {
      operatingSystems.forEach((os, j) => {
        const dataPoint = browserHeatMapData.find(d => d.x === browser && d.y === os);
        const value = dataPoint?.value || 0;
        
        g.append('rect')
          .attr('class', 'browser-cell')
          .attr('x', i * cellWidth)
          .attr('y', j * cellHeight)
          .attr('width', cellWidth - 1)
          .attr('height', cellHeight - 1)
          .attr('fill', value === 0 ? '#f3f4f6' : colorScale(value))
          .attr('stroke', '#e5e7eb')
          .style('cursor', 'pointer')
          .datum(dataPoint || { x: browser, y: os, value: 0, errors: [] })
          .on('mouseover', function(event, d) {
            setHoveredCell({ type: 'browser', data: d });
            const [mouseX, mouseY] = d3.pointer(event, svg.node());
            setMousePosition({ x: mouseX, y: mouseY });
            
            d3.select(this).attr('stroke', '#374151').attr('stroke-width', 2);
          })
          .on('mouseout', function() {
            setHoveredCell(null);
            d3.select(this).attr('stroke', '#e5e7eb').attr('stroke-width', 1);
          });
      });
    });

    // Add browser labels (x-axis)
    g.selectAll('.browser-label')
      .data(browsers)
      .enter()
      .append('text')
      .attr('class', 'browser-label')
      .attr('x', (d, i) => i * cellWidth + cellWidth / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', '#6b7280')
      .text(d => d);

    // Add OS labels (y-axis)
    g.selectAll('.os-label')
      .data(operatingSystems)
      .enter()
      .append('text')
      .attr('class', 'os-label')
      .attr('x', -10)
      .attr('y', (d, i) => i * cellHeight + cellHeight / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .style('font-size', '12px')
      .style('fill', '#6b7280')
      .text(d => d);

  }, [browserHeatMapData, height]);

  // Draw heat maps when data changes
  useEffect(() => {
    drawTimeHeatMap();
  }, [drawTimeHeatMap]);

  useEffect(() => {
    drawLocationHeatMap();
  }, [drawLocationHeatMap]);

  useEffect(() => {
    drawBrowserHeatMap();
  }, [drawBrowserHeatMap]);

  const exportHeatMap = (type: string) => {
    let svgElement: SVGSVGElement | null = null;
    
    switch (type) {
      case 'time':
        svgElement = timeHeatMapRef.current;
        break;
      case 'location':
        svgElement = locationHeatMapRef.current;
        break;
      case 'browser':
        svgElement = browserHeatMapRef.current;
        break;
    }
    
    if (!svgElement) return;

    const serializer = new XMLSerializer();
    const svgData = serializer.serializeToString(svgElement);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${type}-heatmap-${new Date().toISOString().split('T')[0]}.svg`;
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
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <IconChartDots className="size-6 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-gray-800 dark:text-gray-200">Error Heat Maps</span>
                <Badge variant="secondary" className="ml-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-0 font-light">
                  {filteredErrors.length} errors
                </Badge>
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400 text-base font-light mt-2">
                Visual analytics showing error patterns across time, location, and platforms
              </CardDescription>
            </div>
            
            <div className="flex items-center gap-2">
              <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
                <SelectTrigger className="w-24 h-8 bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-gray-200 dark:border-gray-700 font-light">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">1 Hour</SelectItem>
                  <SelectItem value="6h">6 Hours</SelectItem>
                  <SelectItem value="24h">24 Hours</SelectItem>
                  <SelectItem value="7d">7 Days</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <Tabs defaultValue="time" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6 bg-white/20 dark:bg-gray-700/20 border-0">
              <TabsTrigger value="time" className="flex items-center gap-2 font-light text-gray-700 dark:text-gray-300 data-[state=active]:bg-white/50 data-[state=active]:text-gray-900 dark:data-[state=active]:bg-gray-800/50 dark:data-[state=active]:text-gray-100">
                <IconClock className="size-4" />
                Time Patterns
              </TabsTrigger>
              <TabsTrigger value="location" className="flex items-center gap-2 font-light text-gray-700 dark:text-gray-300 data-[state=active]:bg-white/50 data-[state=active]:text-gray-900 dark:data-[state=active]:bg-gray-800/50 dark:data-[state=active]:text-gray-100">
                <IconMapPin className="size-4" />
                Page Locations
              </TabsTrigger>
              <TabsTrigger value="browser" className="flex items-center gap-2 font-light text-gray-700 dark:text-gray-300 data-[state=active]:bg-white/50 data-[state=active]:text-gray-900 dark:data-[state=active]:bg-gray-800/50 dark:data-[state=active]:text-gray-100">
                <IconDevices className="size-4" />
                Browser/OS
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="time" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-normal text-gray-800 dark:text-gray-200">Time-based Error Distribution</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 font-light">
                    Shows error frequency across hours and days of the week
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => exportHeatMap('time')}
                  className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors font-normal"
                >
                  <IconDownload className="size-4 mr-1 text-blue-600 dark:text-blue-400" />
                  Export
                </Button>
              </div>
              
              <div className="relative w-full overflow-x-auto">
                <svg ref={timeHeatMapRef} className="w-full min-w-[600px]" />
              </div>
            </TabsContent>
            
            <TabsContent value="location" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-normal text-gray-800 dark:text-gray-200">Errors by Page Location</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 font-light">
                    Top pages with the most errors, colored by severity
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => exportHeatMap('location')}
                  className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-gray-200 dark:border-gray-700 hover:bg-purple-50 dark:hover:bg-purple-950/20 transition-colors font-normal"
                >
                  <IconDownload className="size-4 mr-1 text-purple-600 dark:text-purple-400" />
                  Export
                </Button>
              </div>
              
              <div className="relative w-full overflow-x-auto">
                <svg ref={locationHeatMapRef} className="w-full min-w-[600px]" />
              </div>
              
              {locationHeatMapData.length === 0 && (
                <div className="flex items-center justify-center h-48 text-center">
                  <div>
                    <IconMapPin className="size-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                    <h3 className="text-lg font-normal mb-2 text-gray-800 dark:text-gray-200">No location data</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-light">
                      URL information is not available for the selected time range.
                    </p>
                  </div>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="browser" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-normal text-gray-800 dark:text-gray-200">Browser & OS Distribution</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 font-light">
                    Error frequency across different browser and operating system combinations
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => exportHeatMap('browser')}
                  className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-gray-200 dark:border-gray-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors font-normal"
                >
                  <IconDownload className="size-4 mr-1 text-emerald-600 dark:text-emerald-400" />
                  Export
                </Button>
              </div>
              
              <div className="relative w-full overflow-x-auto">
                <svg ref={browserHeatMapRef} className="w-full min-w-[400px]" />
              </div>
              
              {browserHeatMapData.length === 0 && (
                <div className="flex items-center justify-center h-48 text-center">
                  <div>
                    <IconBrowser className="size-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                    <h3 className="text-lg font-normal mb-2 text-gray-800 dark:text-gray-200">No browser data</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-light">
                      User agent information is not available for the selected time range.
                    </p>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      
      {/* Tooltip */}
      {hoveredCell && (
        <div 
          className="absolute bg-black text-white p-3 rounded-lg shadow-lg pointer-events-none z-20 max-w-sm"
          style={{ 
            left: mousePosition.x + 10, 
            top: mousePosition.y - 10,
            transform: 'translateY(-100%)'
          }}
        >
          {hoveredCell.type === 'time' && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <IconClock className="size-4" />
                <span className="text-sm font-light">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][(hoveredCell.data as TimeHeatMapData).day]} {(hoveredCell.data as TimeHeatMapData).hour}:00
                </span>
              </div>
              <p className="text-sm font-light">
                {(hoveredCell.data as TimeHeatMapData).value} error{(hoveredCell.data as TimeHeatMapData).value !== 1 ? 's' : ''}
              </p>
            </div>
          )}
          
          {hoveredCell.type === 'location' && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <IconMapPin className="size-4" />
                <Badge 
                  className="text-xs border-0 font-light"
                  style={{ 
                    backgroundColor: severityColors[(hoveredCell.data as LocationHeatMapData).severity as keyof typeof severityColors],
                    color: getContrastColor(severityColors[(hoveredCell.data as LocationHeatMapData).severity as keyof typeof severityColors])
                  }}
                >
                  {(hoveredCell.data as LocationHeatMapData).severity.toUpperCase()}
                </Badge>
              </div>
              <p className="text-sm font-light mb-1">
                {(hoveredCell.data as LocationHeatMapData).fullUrl}
              </p>
              <p className="text-sm font-light">
                {(hoveredCell.data as LocationHeatMapData).count} error{(hoveredCell.data as LocationHeatMapData).count !== 1 ? 's' : ''}
              </p>
            </div>
          )}
          
          {hoveredCell.type === 'browser' && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <IconDevices className="size-4" />
                <span className="text-sm font-light">
                  {(hoveredCell.data as HeatMapData).x} on {(hoveredCell.data as HeatMapData).y}
                </span>
              </div>
              <p className="text-sm font-light">
                {(hoveredCell.data as HeatMapData).value} error{(hoveredCell.data as HeatMapData).value !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};