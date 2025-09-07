'use client';

import { useState } from 'react';
import { ErrorListView } from "./error-list-view";
import { ImpactAssessmentDashboard } from "./impact-assessment-dashboard";
import { RootCauseAnalysisHelper } from "./root-cause-analysis-helper";
import { ErrorPredictionAlerts } from "./error-prediction-alerts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Mock data for impact assessment - in real app this would come from API
const mockImpactData = [
  {
    id: 1,
    message: "TypeError: Cannot read properties of null",
    occurrences: 147,
    affectedUsers: 89,
    revenueImpact: 15420,
    userDropoffRate: 23.5,
    criticalityScore: 85,
    businessPriority: 'critical' as const,
    estimatedFixTime: 4,
    categoryImpact: [
      { category: 'Checkout', impact: 78, trend: 'up' as const },
      { category: 'Navigation', impact: 45, trend: 'stable' as const },
      { category: 'User Auth', impact: 12, trend: 'down' as const },
    ],
  },
  {
    id: 2,
    message: "Network error: Failed to fetch user data",
    occurrences: 89,
    affectedUsers: 67,
    revenueImpact: 8920,
    userDropoffRate: 18.2,
    criticalityScore: 72,
    businessPriority: 'high' as const,
    estimatedFixTime: 2,
    categoryImpact: [
      { category: 'Profile', impact: 65, trend: 'up' as const },
      { category: 'Settings', impact: 34, trend: 'down' as const },
      { category: 'Dashboard', impact: 28, trend: 'stable' as const },
    ],
  },
  {
    id: 3,
    message: "ReferenceError: localStorage is not defined",
    occurrences: 234,
    affectedUsers: 156,
    revenueImpact: 12340,
    userDropoffRate: 31.7,
    criticalityScore: 68,
    businessPriority: 'medium' as const,
    estimatedFixTime: 6,
    categoryImpact: [
      { category: 'Storage', impact: 89, trend: 'up' as const },
      { category: 'Preferences', impact: 56, trend: 'stable' as const },
      { category: 'Cache', impact: 23, trend: 'down' as const },
    ],
  },
  {
    id: 4,
    message: "Uncaught Promise rejection in payment flow",
    occurrences: 45,
    affectedUsers: 42,
    revenueImpact: 25680,
    userDropoffRate: 87.3,
    criticalityScore: 94,
    businessPriority: 'critical' as const,
    estimatedFixTime: 8,
    categoryImpact: [
      { category: 'Payments', impact: 95, trend: 'up' as const },
      { category: 'Checkout', impact: 78, trend: 'up' as const },
      { category: 'Orders', impact: 45, trend: 'stable' as const },
    ],
  },
];

export function ErrorsPageClient() {
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');
  const [selectedErrors] = useState<string[]>([]);

  return (
    <div className="w-full space-y-6">
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Error List</TabsTrigger>
          <TabsTrigger value="impact">Impact Assessment</TabsTrigger>
          <TabsTrigger value="analysis">Root Cause Analysis</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <ErrorListView />
        </TabsContent>

        <TabsContent value="impact" className="mt-6">
          <ImpactAssessmentDashboard
            errors={mockImpactData}
            selectedTimeRange={selectedTimeRange}
            onTimeRangeChange={setSelectedTimeRange}
          />
        </TabsContent>

        <TabsContent value="analysis" className="mt-6">
          <RootCauseAnalysisHelper
            selectedErrors={[]}
            onInsightSelect={(insight) => {
              console.log('Selected insight:', insight);
            }}
          />
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          <ErrorPredictionAlerts />
        </TabsContent>
      </Tabs>
    </div>
  );
}