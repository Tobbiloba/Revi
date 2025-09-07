'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Brain, 
  ChevronDown, 
  ChevronRight,
  Target,
  Code,
  Clock,
  Link,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  Search,
  Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ErrorData {
  id: number;
  message: string;
  stackTrace: string;
  url: string;
  timestamp: Date;
  userAgent: string;
  sessionId: string;
  metadata: Record<string, unknown>;
}

interface RootCauseInsight {
  id: string;
  type: 'pattern' | 'correlation' | 'anomaly' | 'dependency' | 'environmental';
  title: string;
  description: string;
  confidence: number;
  evidence: string[];
  suggestedActions: string[];
  impact: 'low' | 'medium' | 'high' | 'critical';
  relatedErrors: number[];
}

interface RootCauseAnalysisHelperProps {
  selectedErrors: ErrorData[];
  onInsightSelect: (insight: RootCauseInsight) => void;
  className?: string;
}

export function RootCauseAnalysisHelper({ 
  selectedErrors, 
  onInsightSelect, 
  className 
}: RootCauseAnalysisHelperProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [expandedInsights, setExpandedInsights] = useState<Set<string>>(new Set());
  const [analysisComplete, setAnalysisComplete] = useState(false);

  const mockInsights: RootCauseInsight[] = useMemo(() => [
    {
      id: 'pattern-1',
      type: 'pattern',
      title: 'Recurring Null Reference Pattern',
      description: 'Multiple errors following the same pattern: accessing properties on null/undefined objects after async operations.',
      confidence: 92,
      evidence: [
        'Similar stack trace patterns in 85% of selected errors',
        'All occurrences happen within 200ms of API responses',
        'Concentrated in user authentication flows',
        'Higher frequency during peak traffic hours'
      ],
      suggestedActions: [
        'Add null checks before property access',
        'Implement loading states for async operations',
        'Add error boundaries around authentication components',
        'Consider using optional chaining (?.) operator'
      ],
      impact: 'high',
      relatedErrors: [1, 3, 5, 7]
    },
    {
      id: 'correlation-1',
      type: 'correlation',
      title: 'Third-party Service Dependency',
      description: 'Strong correlation between errors and external payment service response times > 5 seconds.',
      confidence: 88,
      evidence: [
        '78% of payment errors occur when external API latency > 5s',
        'Error spike correlates with payment provider maintenance windows',
        'Geographic distribution matches payment service outages',
        'Retry mechanisms showing 3x failure rate during slow responses'
      ],
      suggestedActions: [
        'Implement circuit breaker pattern for payment service',
        'Add timeout handling with graceful degradation',
        'Implement payment service health checks',
        'Consider alternative payment provider for failover'
      ],
      impact: 'critical',
      relatedErrors: [2, 4, 8, 12]
    },
    {
      id: 'anomaly-1',
      type: 'anomaly',
      title: 'Memory Leak in Session Management',
      description: 'Unusual memory growth pattern leading to performance degradation and eventual crashes.',
      confidence: 76,
      evidence: [
        'Memory usage increases 15% per hour in affected sessions',
        'Event listeners not being properly removed',
        'DOM nodes accumulating without cleanup',
        'Performance timeline shows consistent degradation'
      ],
      suggestedActions: [
        'Audit event listener cleanup in useEffect hooks',
        'Implement memory profiling in development',
        'Add cleanup functions for session data',
        'Review component unmounting lifecycle'
      ],
      impact: 'medium',
      relatedErrors: [6, 9, 11]
    },
    {
      id: 'environmental-1',
      type: 'environmental',
      title: 'Browser-Specific Compatibility Issue',
      description: 'Errors predominantly affecting Safari users, likely due to webkit-specific behaviors.',
      confidence: 94,
      evidence: [
        '89% of these errors occur on Safari browsers',
        'localStorage behavior differences in private mode',
        'CSS Grid layout inconsistencies',
        'Date parsing differences causing calculation errors'
      ],
      suggestedActions: [
        'Implement Safari-specific polyfills',
        'Add browser detection for feature gating',
        'Test localStorage availability before usage',
        'Use standardized date formatting'
      ],
      impact: 'medium',
      relatedErrors: [10, 13, 15]
    },
    {
      id: 'dependency-1',
      type: 'dependency',
      title: 'Outdated Library Version Vulnerability',
      description: 'Errors traced to known issues in outdated dependencies with available security patches.',
      confidence: 85,
      evidence: [
        'Stack traces match known vulnerability CVE-2023-1234',
        'Error patterns documented in library changelog',
        'Security advisories recommend immediate update',
        'Community reports of similar issues resolved in v2.1.4'
      ],
      suggestedActions: [
        'Update affected library to latest stable version',
        'Review security audit for other vulnerable dependencies',
        'Implement automated dependency scanning',
        'Add security update notifications to CI/CD'
      ],
      impact: 'high',
      relatedErrors: [14, 16, 17]
    }
  ], []);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    // Simulate analysis time
    await new Promise(resolve => setTimeout(resolve, 3000));
    setIsAnalyzing(false);
    setAnalysisComplete(true);
  };

  const toggleInsight = (insightId: string) => {
    setExpandedInsights(prev => {
      const newSet = new Set(prev);
      if (newSet.has(insightId)) {
        newSet.delete(insightId);
      } else {
        newSet.add(insightId);
      }
      return newSet;
    });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'pattern': return Target;
      case 'correlation': return Link;
      case 'anomaly': return TrendingUp;
      case 'dependency': return Code;
      case 'environmental': return Shield;
      default: return Search;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'pattern': return 'bg-blue-100 text-blue-800';
      case 'correlation': return 'bg-purple-100 text-purple-800';
      case 'anomaly': return 'bg-orange-100 text-orange-800';
      case 'dependency': return 'bg-green-100 text-green-800';
      case 'environmental': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'critical': return 'text-red-600';
      case 'high': return 'text-orange-600';
      case 'medium': return 'text-yellow-600';
      default: return 'text-green-600';
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="size-6 text-purple-600" />
            Root Cause Analysis Helper
          </CardTitle>
          <CardDescription>
            AI-powered analysis to identify underlying patterns and causes in your selected errors
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                Selected Errors: <strong>{selectedErrors.length}</strong>
              </span>
              {analysisComplete && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Lightbulb className="size-3" />
                  {mockInsights.length} insights found
                </Badge>
              )}
            </div>
            <Button 
              onClick={handleAnalyze}
              disabled={selectedErrors.length === 0 || isAnalyzing}
              className="flex items-center gap-2"
            >
              <Search className="size-4" />
              {isAnalyzing ? 'Analyzing...' : 'Analyze Root Causes'}
            </Button>
          </div>

          {isAnalyzing && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Search className="size-4 animate-pulse" />
                Analyzing error patterns and correlations...
              </div>
              <Progress value={66} className="h-2" />
              <div className="text-xs text-muted-foreground">
                Processing {selectedErrors.length} errors • Detecting patterns • Correlating with external factors
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {analysisComplete && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Analysis Results</h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="size-4" />
              Analyzed {new Date().toLocaleTimeString()}
            </div>
          </div>

          <div className="grid gap-4">
            {mockInsights.map((insight) => {
              const IconComponent = getTypeIcon(insight.type);
              const isExpanded = expandedInsights.has(insight.id);

              return (
                <Card key={insight.id} className="border-l-4 border-l-purple-500">
                  <Collapsible>
                    <CollapsibleTrigger 
                      className="w-full"
                      onClick={() => toggleInsight(insight.id)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-3">
                            <IconComponent className="size-5 text-purple-600" />
                            <div className="text-left">
                              <CardTitle className="text-base">{insight.title}</CardTitle>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge className={getTypeColor(insight.type)}>
                                  {insight.type}
                                </Badge>
                                <span className={cn("text-sm font-medium", getImpactColor(insight.impact))}>
                                  {insight.impact} impact
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  {insight.confidence}% confidence
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Progress value={insight.confidence} className="w-20 h-2" />
                            {isExpanded ? (
                              <ChevronDown className="size-4" />
                            ) : (
                              <ChevronRight className="size-4" />
                            )}
                          </div>
                        </div>
                        <CardDescription className="text-left">
                          {insight.description}
                        </CardDescription>
                      </CardHeader>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <CardContent className="pt-0 space-y-4">
                        {/* Evidence */}
                        <div>
                          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                            <AlertTriangle className="size-4" />
                            Evidence Found
                          </h4>
                          <ul className="space-y-1">
                            {insight.evidence.map((evidence, index) => (
                              <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                                <div className="size-1.5 bg-purple-600 rounded-full mt-2 flex-shrink-0" />
                                {evidence}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Suggested Actions */}
                        <div>
                          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                            <Lightbulb className="size-4" />
                            Suggested Actions
                          </h4>
                          <ul className="space-y-1">
                            {insight.suggestedActions.map((action, index) => (
                              <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                                <div className="size-1.5 bg-green-600 rounded-full mt-2 flex-shrink-0" />
                                {action}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Related Errors */}
                        <div>
                          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                            <Link className="size-4" />
                            Related Errors ({insight.relatedErrors.length})
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {insight.relatedErrors.map((errorId) => (
                              <Badge key={errorId} variant="outline" className="text-xs">
                                Error #{errorId}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 pt-2 border-t">
                          <Button 
                            size="sm" 
                            onClick={() => onInsightSelect(insight)}
                            className="flex items-center gap-1"
                          >
                            <Target className="size-3" />
                            Apply Fix
                          </Button>
                          <Button size="sm" variant="outline">
                            Export Analysis
                          </Button>
                          <Button size="sm" variant="outline">
                            Share with Team
                          </Button>
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {selectedErrors.length === 0 && !isAnalyzing && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-96">
            <Brain className="size-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-muted-foreground mb-2">
              Select Errors to Analyze
            </h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Choose one or more errors from the error list to start the root cause analysis. 
              The AI will identify patterns, correlations, and suggest actionable solutions.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}