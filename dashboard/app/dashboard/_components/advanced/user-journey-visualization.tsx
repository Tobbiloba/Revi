'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { sankey as d3Sankey, sankeyLinkHorizontal as d3SankeyLinkHorizontal } from 'd3-sankey';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IconRoute, IconUsers, IconTarget, IconTrendingDown, IconDownload, IconRefresh } from '@tabler/icons-react';
import { ErrorWithSession } from '@/lib/revi-api';
import { cn } from '@/lib/utils';
import defaultApiClient from '@/lib/revi-api';

interface UserJourneyVisualizationProps {
  errors: ErrorWithSession[];
  className?: string;
  height?: number;
}

interface JourneyNode {
  id: string;
  name: string;
  url: string;
  visits: number;
  errors: number;
  dropOffRate: number;
  avgTimeSpent: number;
  type: 'entry' | 'page' | 'exit' | 'error';
}

interface JourneyLink {
  source: string;
  target: string;
  value: number;
  errorRate: number;
  avgTransitionTime: number;
}

interface SankeyData {
  nodes: JourneyNode[];
  links: JourneyLink[];
}

interface UserFlow {
  sessionId: string;
  userId?: string;
  path: string[];
  timestamps: Date[];
  errors: ErrorWithSession[];
  duration: number;
  converted: boolean;
}

const nodeColors = {
  entry: '#10b981', // green
  page: '#3b82f6',  // blue
  exit: '#f59e0b',  // amber
  error: '#ef4444'  // red
};

export const UserJourneyVisualization: React.FC<UserJourneyVisualizationProps> = ({
  errors,
  className,
  height = 500
}) => {
  const sankeyRef = useRef<SVGSVGElement>(null);
  const funnelRef = useRef<SVGSVGElement>(null);
  const [hoveredNode, setHoveredNode] = useState<JourneyNode | null>(null);
  const [hoveredLink, setHoveredLink] = useState<JourneyLink | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');
  const [viewMode, setViewMode] = useState<'sankey' | 'funnel'>('sankey');

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

  // State for real user journey data
  const [userFlows, setUserFlows] = useState<UserFlow[]>([]);
  const [isLoadingJourneys, setIsLoadingJourneys] = useState(true);

  // Fetch real user journey data from API
  useEffect(() => {
    const fetchUserJourneys = async () => {
      try {
        setIsLoadingJourneys(true);
        const response = await defaultApiClient.getUserJourneys({
          limit: 50,
          days: selectedTimeRange === '1h' ? 1 : selectedTimeRange === '24h' ? 1 : selectedTimeRange === '7d' ? 7 : 30
        });
        
        // Convert API response to UserFlow format
        const flows: UserFlow[] = response.journeys.map(journey => ({
          sessionId: journey.sessionId,
          userId: journey.userId,
          path: journey.path,
          timestamps: journey.timestamps,
          errors: journey.errors,
          duration: journey.duration,
          converted: journey.converted
        }));
        
        setUserFlows(flows);
      } catch (error) {
        console.error('Failed to fetch user journeys:', error);
        // Fallback to empty array on error
        setUserFlows([]);
      } finally {
        setIsLoadingJourneys(false);
      }
    };

    fetchUserJourneys();
  }, [selectedTimeRange, filteredErrors]);

  // Process flows into Sankey data
  const sankeyData = useMemo((): SankeyData => {
    const nodeMap = new Map<string, JourneyNode>();
    const linkMap = new Map<string, JourneyLink>();

    // Process all flows to create nodes and links
    userFlows.forEach(flow => {
      flow.path.forEach((page, index) => {
        // Create or update node
        if (!nodeMap.has(page)) {
          const nodeType: JourneyNode['type'] = 
            index === 0 ? 'entry' :
            index === flow.path.length - 1 ? (flow.errors.some(e => e.url === page) ? 'error' : 'exit') :
            flow.errors.some(e => e.url === page) ? 'error' : 'page';

          nodeMap.set(page, {
            id: page,
            name: page.split('/').pop() || page,
            url: page,
            visits: 0,
            errors: 0,
            dropOffRate: 0,
            avgTimeSpent: 0,
            type: nodeType
          });
        }

        const node = nodeMap.get(page)!;
        node.visits++;
        node.errors += flow.errors.filter(e => e.url === page).length;

        // Create link to next page
        if (index < flow.path.length - 1) {
          const nextPage = flow.path[index + 1];
          const linkId = `${page}->${nextPage}`;
          
          if (!linkMap.has(linkId)) {
            linkMap.set(linkId, {
              source: page,
              target: nextPage,
              value: 0,
              errorRate: 0,
              avgTransitionTime: 0
            });
          }

          const link = linkMap.get(linkId)!;
          link.value++;
          
          const hasError = flow.errors.some(e => e.url === nextPage);
          if (hasError) {
            link.errorRate += 1;
          }
          
          if (index + 1 < flow.timestamps.length) {
            const transitionTime = flow.timestamps[index + 1].getTime() - flow.timestamps[index].getTime();
            link.avgTransitionTime = (link.avgTransitionTime * (link.value - 1) + transitionTime) / link.value;
          }
        }
      });
    });

    // Calculate drop-off rates
    nodeMap.forEach(node => {
      const totalVisits = node.visits;
      const outgoingValue = Array.from(linkMap.values())
        .filter(link => link.source === node.id)
        .reduce((sum, link) => sum + link.value, 0);
      
      node.dropOffRate = totalVisits > 0 ? ((totalVisits - outgoingValue) / totalVisits) * 100 : 0;
    });

    // Normalize error rates in links
    linkMap.forEach(link => {
      link.errorRate = link.value > 0 ? (link.errorRate / link.value) * 100 : 0;
    });

    return {
      nodes: Array.from(nodeMap.values()),
      links: Array.from(linkMap.values())
    };
  }, [userFlows]);

  const drawSankeyDiagram = useCallback(() => {
    const svg = d3.select(sankeyRef.current);
    if (!svg.node() || sankeyData.nodes.length === 0) return;

    svg.selectAll('*').remove();

    const margin = { top: 20, right: 30, bottom: 20, left: 30 };
    const width = (svg.node() as SVGSVGElement).clientWidth || 800;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create Sankey generator
    const sankey = d3Sankey<JourneyNode, JourneyLink>()
      .nodeId(d => d.id)
      .nodeWidth(15)
      .nodePadding(10)
      .extent([[1, 1], [width - margin.left - margin.right - 1, innerHeight - 1]]);

    const sankeyGraph = sankey({
      nodes: sankeyData.nodes.map(d => ({ ...d })),
      links: sankeyData.links.map(d => ({ ...d }))
    });

    // Add links
    g.append('g')
      .selectAll('path')
      .data(sankeyGraph.links)
      .enter()
      .append('path')
      .attr('d', d3SankeyLinkHorizontal())
      .attr('stroke', (d: { errorRate?: number }) => {
        const errorRate = d.errorRate || 0;
        return errorRate > 20 ? '#ef4444' : errorRate > 10 ? '#f59e0b' : '#64748b';
      })
      .attr('stroke-opacity', 0.5)
      .attr('stroke-width', (d: { width?: number }) => Math.max(1, d.width || 0))
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        const link = d as { source: { id: string }; target: { id: string }; value: number; errorRate?: number; avgTransitionTime?: number };
        setHoveredLink({
          source: link.source.id,
          target: link.target.id,
          value: link.value,
          errorRate: link.errorRate || 0,
          avgTransitionTime: link.avgTransitionTime || 0
        });
        const [mouseX, mouseY] = d3.pointer(event, svg.node());
        setMousePosition({ x: mouseX, y: mouseY });
        
        d3.select(this).attr('stroke-opacity', 0.8);
      })
      .on('mouseout', function() {
        setHoveredLink(null);
        d3.select(this).attr('stroke-opacity', 0.5);
      });

    // Add nodes
    const nodeGroup = g.append('g')
      .selectAll('g')
      .data(sankeyGraph.nodes)
      .enter()
      .append('g')
      .style('cursor', 'pointer');

    nodeGroup
      .append('rect')
      .attr('x', (d: { x0?: number }) => d.x0 || 0)
      .attr('y', (d: { y0?: number }) => d.y0 || 0)
      .attr('height', (d: { y1?: number; y0?: number }) => Math.max(1, (d.y1 || 0) - (d.y0 || 0)))
      .attr('width', (d: { x1?: number; x0?: number }) => Math.max(1, (d.x1 || 0) - (d.x0 || 0)))
      .attr('fill', d => nodeColors[(d as JourneyNode).type])
      .attr('rx', 3)
      .on('mouseover', function(event, d) {
        setHoveredNode(d as JourneyNode);
        const [mouseX, mouseY] = d3.pointer(event, svg.node());
        setMousePosition({ x: mouseX, y: mouseY });
        
        d3.select(this).attr('opacity', 0.8);
      })
      .on('mouseout', function() {
        setHoveredNode(null);
        d3.select(this).attr('opacity', 1);
      });

    // Add node labels
    nodeGroup
      .append('text')
      .attr('x', (d: { x0?: number; x1?: number }) => (d.x0 || 0) < width / 2 ? (d.x1 || 0) + 6 : (d.x0 || 0) - 6)
      .attr('y', (d: { y1?: number; y0?: number }) => ((d.y1 || 0) + (d.y0 || 0)) / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', (d: { x0?: number }) => (d.x0 || 0) < width / 2 ? 'start' : 'end')
      .style('font-size', '12px')
      .style('font-weight', '500')
      .style('fill', '#374151')
      .text(d => (d as JourneyNode).name);

  }, [sankeyData, height]);

  const drawFunnelChart = useCallback(() => {
    const svg = d3.select(funnelRef.current);
    if (!svg.node() || sankeyData.nodes.length === 0) return;

    svg.selectAll('*').remove();

    const margin = { top: 20, right: 30, bottom: 40, left: 30 };
    const width = (svg.node() as SVGSVGElement).clientWidth || 800;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Sort nodes by visits for funnel
    const funnelNodes = sankeyData.nodes
      .filter(node => node.type !== 'error')
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 6); // Top 6 pages

    const maxVisits = Math.max(...funnelNodes.map(node => node.visits));
    const stepHeight = innerHeight / funnelNodes.length;

    // Create funnel steps
    funnelNodes.forEach((node, index) => {
      const stepWidth = (node.visits / maxVisits) * (width - margin.left - margin.right);
      const x = (width - margin.left - margin.right - stepWidth) / 2;
      const y = index * stepHeight;

      // Funnel step
      const step = g.append('g').attr('class', 'funnel-step');

      step.append('rect')
        .attr('x', x)
        .attr('y', y + stepHeight * 0.1)
        .attr('width', stepWidth)
        .attr('height', stepHeight * 0.8)
        .attr('fill', nodeColors[node.type])
        .attr('rx', 5)
        .style('cursor', 'pointer')
        .on('mouseover', function(event) {
          setHoveredNode(node);
          const [mouseX, mouseY] = d3.pointer(event, svg.node());
          setMousePosition({ x: mouseX, y: mouseY });
          
          d3.select(this).attr('opacity', 0.8);
        })
        .on('mouseout', function() {
          setHoveredNode(null);
          d3.select(this).attr('opacity', 1);
        });

      // Step label
      step.append('text')
        .attr('x', x + stepWidth / 2)
        .attr('y', y + stepHeight / 2)
        .attr('dy', '-0.2em')
        .attr('text-anchor', 'middle')
        .style('font-size', '14px')
        .style('font-weight', '600')
        .style('fill', 'white')
        .text(node.name);

      // Visits count
      step.append('text')
        .attr('x', x + stepWidth / 2)
        .attr('y', y + stepHeight / 2)
        .attr('dy', '1em')
        .attr('text-anchor', 'middle')
        .style('font-size', '12px')
        .style('fill', 'white')
        .style('opacity', 0.9)
        .text(`${node.visits} visits`);

      // Drop-off indicator
      if (index < funnelNodes.length - 1) {
        const nextNode = funnelNodes[index + 1];
        const dropOff = node.visits - nextNode.visits;
        const dropOffRate = (dropOff / node.visits) * 100;

        if (dropOffRate > 0) {
          step.append('text')
            .attr('x', width - margin.left - margin.right)
            .attr('y', y + stepHeight)
            .attr('dy', '-0.5em')
            .attr('text-anchor', 'end')
            .style('font-size', '11px')
            .style('fill', '#ef4444')
            .style('font-weight', '500')
            .text(`↓ ${dropOffRate.toFixed(1)}% drop-off`);
        }
      }
    });

  }, [sankeyData, height]);

  // Draw visualizations when data changes
  useEffect(() => {
    if (viewMode === 'sankey') {
      drawSankeyDiagram();
    } else {
      drawFunnelChart();
    }
  }, [viewMode, drawSankeyDiagram, drawFunnelChart]);

  const exportVisualization = () => {
    const svgElement = viewMode === 'sankey' ? sankeyRef.current : funnelRef.current;
    if (!svgElement) return;

    const serializer = new XMLSerializer();
    const svgData = serializer.serializeToString(svgElement);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `user-journey-${viewMode}-${new Date().toISOString().split('T')[0]}.svg`;
    link.click();
    
    URL.revokeObjectURL(url);
  };

  const refreshData = async () => {
    try {
      setIsLoadingJourneys(true);
      const response = await defaultApiClient.getUserJourneys({
        limit: 50,
        days: selectedTimeRange === '1h' ? 1 : selectedTimeRange === '24h' ? 1 : selectedTimeRange === '7d' ? 7 : 30
      });
      
      const flows: UserFlow[] = response.journeys.map(journey => ({
        sessionId: journey.sessionId,
        userId: journey.userId,
        path: journey.path,
        timestamps: journey.timestamps,
        errors: journey.errors,
        duration: journey.duration,
        converted: journey.converted
      }));
      
      setUserFlows(flows);
    } catch (error) {
      console.error('Failed to refresh user journeys:', error);
    } finally {
      setIsLoadingJourneys(false);
    }
  };

  return (
    <div className={cn("flex flex-col", className)}>
      <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-3 text-xl font-normal">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <IconRoute className="size-6 text-purple-600 dark:text-purple-400" />
                </div>
                <span className="text-gray-800 dark:text-gray-200">User Journey Visualization</span>
                <Badge variant="secondary" className="ml-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-0 font-light">
                  {isLoadingJourneys ? 'Loading...' : `${userFlows.length} sessions`}
                </Badge>
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400 text-base font-light mt-2">
                Visualize user flows and identify error injection points with interactive diagrams
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
              
              <Button variant="outline" size="sm" onClick={refreshData} className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-gray-200 dark:border-gray-700 hover:bg-yellow-50 dark:hover:bg-yellow-950/20 transition-colors font-normal">
                <IconRefresh className="size-4 text-yellow-600 dark:text-yellow-400" />
              </Button>
              
              <Button variant="outline" size="sm" onClick={exportVisualization} className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-gray-200 dark:border-gray-700 hover:bg-purple-50 dark:hover:bg-purple-950/20 transition-colors font-normal">
                <IconDownload className="size-4 text-purple-600 dark:text-purple-400" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'sankey' | 'funnel')} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6 bg-white/20 dark:bg-gray-700/20 border-0">
              <TabsTrigger value="sankey" className="flex items-center gap-2 font-light text-gray-700 dark:text-gray-300 data-[state=active]:bg-white/50 data-[state=active]:text-gray-900 dark:data-[state=active]:bg-gray-800/50 dark:data-[state=active]:text-gray-100">
                <IconRoute className="size-4" />
                Flow Diagram
              </TabsTrigger>
              <TabsTrigger value="funnel" className="flex items-center gap-2 font-light text-gray-700 dark:text-gray-300 data-[state=active]:bg-white/50 data-[state=active]:text-gray-900 dark:data-[state=active]:bg-gray-800/50 dark:data-[state=active]:text-gray-100">
                <IconTrendingDown className="size-4" />
                Conversion Funnel
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="sankey" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-normal text-gray-800 dark:text-gray-200">User Flow Diagram</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 font-light">
                    Sankey diagram showing user navigation paths and error injection points
                  </p>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="size-3 rounded-full bg-green-500" />
                    <span className="text-gray-700 dark:text-gray-300 font-light">Entry</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="size-3 rounded-full bg-blue-500" />
                    <span className="text-gray-700 dark:text-gray-300 font-light">Page</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="size-3 rounded-full bg-red-500" />
                    <span className="text-gray-700 dark:text-gray-300 font-light">Error</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="size-3 rounded-full bg-amber-500" />
                    <span className="text-gray-700 dark:text-gray-300 font-light">Exit</span>
                  </div>
                </div>
              </div>
              
              <div className="relative w-full overflow-x-auto">
                <svg ref={sankeyRef} className="w-full min-w-[800px]" />
              </div>
            </TabsContent>
            
            <TabsContent value="funnel" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-normal text-gray-800 dark:text-gray-200">Conversion Funnel</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 font-light">
                    Shows user drop-off rates at each step of the journey
                  </p>
                </div>
                
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="text-center">
                    <div className="text-lg font-light text-green-600">{sankeyData.nodes.filter(n => n.type === 'entry').length}</div>
                    <div className="text-gray-600 dark:text-gray-400 font-light">Entry Points</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-light text-red-600">{sankeyData.nodes.filter(n => n.type === 'error').length}</div>
                    <div className="text-gray-600 dark:text-gray-400 font-light">Error Pages</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-light text-amber-600">{userFlows.filter(f => f.converted).length}</div>
                    <div className="text-gray-600 dark:text-gray-400 font-light">Conversions</div>
                  </div>
                </div>
              </div>
              
              <div className="relative w-full overflow-x-auto">
                <svg ref={funnelRef} className="w-full min-w-[600px]" />
              </div>
            </TabsContent>
          </Tabs>
          
          {sankeyData.nodes.length === 0 && (
            <div className="flex flex-col items-center justify-center h-96 text-center">
              <IconUsers className="size-12 text-gray-400 dark:text-gray-500 mb-4" />
              <h3 className="text-lg font-normal mb-2 text-gray-800 dark:text-gray-200">No user journey data</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-light max-w-sm">
                User session data is not available for the selected time range. Sessions with errors will appear here once data is collected.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Tooltip */}
      {(hoveredNode || hoveredLink) && (
        <div 
          className="absolute bg-black text-white p-3 rounded-lg shadow-lg pointer-events-none z-20 max-w-sm"
          style={{ 
            left: mousePosition.x + 10, 
            top: mousePosition.y - 10,
            transform: 'translateY(-100%)'
          }}
        >
          {hoveredNode && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div 
                  className="size-3 rounded-full"
                  style={{ backgroundColor: nodeColors[hoveredNode.type] }}
                />
                <span className="text-sm font-light capitalize">{hoveredNode.type}</span>
              </div>
              <p className="text-sm font-light mb-1">{hoveredNode.url}</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="font-light">Visits:</span>
                  <span className="font-light">{hoveredNode.visits}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-light">Errors:</span>
                  <span className="font-light text-red-300">{hoveredNode.errors}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-light">Drop-off Rate:</span>
                  <span className="font-light">{hoveredNode.dropOffRate.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          )}
          
          {hoveredLink && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <IconTarget className="size-4" />
                <span className="text-sm font-light">Transition</span>
              </div>
              <p className="text-sm mb-1 font-light">
                <span className="font-light">{hoveredLink.source}</span>
                {' → '}
                <span className="font-light">{hoveredLink.target}</span>
              </p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="font-light">Users:</span>
                  <span className="font-light">{hoveredLink.value}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-light">Error Rate:</span>
                  <span className={`font-light ${hoveredLink.errorRate > 20 ? 'text-red-300' : hoveredLink.errorRate > 10 ? 'text-yellow-300' : ''}`}>
                    {hoveredLink.errorRate.toFixed(1)}%
                  </span>
                </div>
                {hoveredLink.avgTransitionTime > 0 && (
                  <div className="flex justify-between">
                    <span className="font-light">Avg Time:</span>
                    <span className="font-light">
                      {(hoveredLink.avgTransitionTime / 1000).toFixed(1)}s
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};