'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { 
  IconBrain, 
  IconBell,
  IconTrendingUp,
  IconTrendingDown,
  IconAlertTriangle,
  IconShield,
  IconBolt,
  IconClock,
  IconTarget,
  IconGraph,
  IconSettings,
  IconEye,
  IconMail,
  IconSlash,
  IconCheck
} from '@tabler/icons-react';
import { cn } from '@/lib/utils';

interface PredictionAlert {
  id: string;
  type: 'spike_prediction' | 'failure_cascade' | 'performance_degradation' | 'security_threat' | 'resource_exhaustion';
  title: string;
  description: string;
  confidence: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  predictedTime: Date;
  affectedComponents: string[];
  preventiveActions: string[];
  isEnabled: boolean;
  lastTriggered: Date | null;
  triggerCount: number;
}

interface ErrorPredictionAlertsProps {
  className?: string;
}

export function ErrorPredictionAlerts({ className }: ErrorPredictionAlertsProps) {
  const [alerts, setAlerts] = useState<PredictionAlert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<string | null>(null);
  const [alertSettings, setAlertSettings] = useState({
    emailNotifications: true,
    slackNotifications: false,
    minimumConfidence: 75,
    alertFrequency: 'immediate'
  });
  const [isMonitoring, setIsMonitoring] = useState(true);

  // Mock prediction alerts
  useEffect(() => {
    const mockAlerts: PredictionAlert[] = [
      {
        id: 'spike-1',
        type: 'spike_prediction',
        title: 'Payment Error Spike Predicted',
        description: 'ML model predicts a 3x increase in payment errors within the next 2 hours based on current traffic patterns and external service response times.',
        confidence: 87,
        severity: 'high',
        predictedTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
        affectedComponents: ['Payment Gateway', 'Checkout Flow', 'Order Processing'],
        preventiveActions: [
          'Scale payment service instances',
          'Enable circuit breaker for external payment API',
          'Increase timeout thresholds',
          'Notify payment team for standby support'
        ],
        isEnabled: true,
        lastTriggered: new Date(Date.now() - 6 * 60 * 60 * 1000),
        triggerCount: 3
      },
      {
        id: 'cascade-1',
        type: 'failure_cascade',
        title: 'Database Connection Failure Cascade',
        description: 'Pattern recognition indicates potential cascade failure starting from database connection pool exhaustion, likely to affect multiple services.',
        confidence: 92,
        severity: 'critical',
        predictedTime: new Date(Date.now() + 45 * 60 * 1000),
        affectedComponents: ['User Service', 'Auth Service', 'Analytics Service', 'Notification Service'],
        preventiveActions: [
          'Increase database connection pool size',
          'Enable connection pooling optimizations',
          'Prepare database failover procedures',
          'Alert database administrators'
        ],
        isEnabled: true,
        lastTriggered: null,
        triggerCount: 0
      },
      {
        id: 'performance-1',
        type: 'performance_degradation',
        title: 'Memory Leak Performance Impact',
        description: 'Gradual memory consumption increase detected. Model predicts performance degradation affecting user experience within 4 hours.',
        confidence: 78,
        severity: 'medium',
        predictedTime: new Date(Date.now() + 4 * 60 * 60 * 1000),
        affectedComponents: ['Frontend Application', 'Session Management'],
        preventiveActions: [
          'Schedule application restart',
          'Monitor memory usage closely',
          'Implement memory profiling',
          'Review recent code changes'
        ],
        isEnabled: true,
        lastTriggered: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        triggerCount: 5
      },
      {
        id: 'security-1',
        type: 'security_threat',
        title: 'Potential Security Breach Pattern',
        description: 'Anomalous authentication failure patterns detected, indicating possible coordinated attack attempt.',
        confidence: 94,
        severity: 'critical',
        predictedTime: new Date(Date.now() + 15 * 60 * 1000),
        affectedComponents: ['Authentication Service', 'User Accounts', 'Session Management'],
        preventiveActions: [
          'Enable rate limiting on auth endpoints',
          'Block suspicious IP ranges',
          'Increase authentication logging',
          'Alert security team immediately'
        ],
        isEnabled: true,
        lastTriggered: new Date(Date.now() - 12 * 60 * 60 * 1000),
        triggerCount: 1
      }
    ];

    setAlerts(mockAlerts);
  }, []);

  const toggleAlert = (alertId: string) => {
    setAlerts(alerts.map(alert => 
      alert.id === alertId 
        ? { ...alert, isEnabled: !alert.isEnabled }
        : alert
    ));
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'spike_prediction': return IconTrendingUp;
      case 'failure_cascade': return IconTarget;
      case 'performance_degradation': return IconTrendingDown;
      case 'security_threat': return IconShield;
      case 'resource_exhaustion': return IconBolt;
      default: return IconAlertTriangle;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'spike_prediction': return 'bg-orange-100 text-orange-800';
      case 'failure_cascade': return 'bg-red-100 text-red-800';
      case 'performance_degradation': return 'bg-yellow-100 text-yellow-800';
      case 'security_threat': return 'bg-purple-100 text-purple-800';
      case 'resource_exhaustion': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-green-600 bg-green-50';
    }
  };

  const formatTimeUntil = (date: Date) => {
    const diff = date.getTime() - Date.now();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `in ${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `in ${minutes}m`;
    } else {
      return 'imminent';
    }
  };

  const activeAlerts = alerts.filter(alert => alert.isEnabled);
  const criticalAlerts = activeAlerts.filter(alert => alert.severity === 'critical');

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header & Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <IconBrain className="size-6 text-blue-600" />
                Error Prediction & Alerts
              </CardTitle>
              <CardDescription>
                AI-powered predictive monitoring and proactive alerting system
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center space-x-2">
                <Switch
                  id="monitoring"
                  checked={isMonitoring}
                  onCheckedChange={setIsMonitoring}
                />
                <Label htmlFor="monitoring">Monitoring Active</Label>
              </div>
              <div className={cn(
                "size-3 rounded-full",
                isMonitoring ? "bg-green-500" : "bg-gray-400"
              )} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3">
              <IconBell className="size-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{activeAlerts.length}</p>
                <p className="text-sm text-muted-foreground">Active Alerts</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <IconAlertTriangle className="size-8 text-red-500" />
              <div>
                <p className="text-2xl font-bold text-red-600">{criticalAlerts.length}</p>
                <p className="text-sm text-muted-foreground">Critical</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <IconTarget className="size-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">
                  {Math.round(activeAlerts.reduce((sum, alert) => sum + alert.confidence, 0) / activeAlerts.length || 0)}%
                </p>
                <p className="text-sm text-muted-foreground">Avg Confidence</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <IconClock className="size-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">
                  {alerts.reduce((sum, alert) => sum + alert.triggerCount, 0)}
                </p>
                <p className="text-sm text-muted-foreground">Total Triggers</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alert Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconSettings className="size-5" />
            Alert Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Minimum Confidence</Label>
              <Select 
                value={alertSettings.minimumConfidence.toString()} 
                onValueChange={(value) => setAlertSettings({...alertSettings, minimumConfidence: parseInt(value)})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50%</SelectItem>
                  <SelectItem value="60">60%</SelectItem>
                  <SelectItem value="70">70%</SelectItem>
                  <SelectItem value="75">75%</SelectItem>
                  <SelectItem value="80">80%</SelectItem>
                  <SelectItem value="90">90%</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Alert Frequency</Label>
              <Select 
                value={alertSettings.alertFrequency} 
                onValueChange={(value) => setAlertSettings({...alertSettings, alertFrequency: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediate">Immediate</SelectItem>
                  <SelectItem value="5min">Every 5 minutes</SelectItem>
                  <SelectItem value="15min">Every 15 minutes</SelectItem>
                  <SelectItem value="1hour">Every hour</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="email"
                checked={alertSettings.emailNotifications}
                onCheckedChange={(checked) => setAlertSettings({...alertSettings, emailNotifications: checked})}
              />
              <Label htmlFor="email" className="flex items-center gap-1">
                <IconMail className="size-4" />
                Email Alerts
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="slack"
                checked={alertSettings.slackNotifications}
                onCheckedChange={(checked) => setAlertSettings({...alertSettings, slackNotifications: checked})}
              />
              <Label htmlFor="slack" className="flex items-center gap-1">
                <IconBell className="size-4" />
                Slack Alerts
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Prediction Alerts List */}
      <Card>
        <CardHeader>
          <CardTitle>Active Predictions</CardTitle>
          <CardDescription>
            Current ML predictions and automated alert configurations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {alerts.map((alert) => {
              const IconComponent = getTypeIcon(alert.type);
              const isExpanded = selectedAlert === alert.id;

              return (
                <div
                  key={alert.id}
                  className={cn(
                    "p-4 rounded-lg border transition-colors",
                    isExpanded ? "border-blue-500 bg-blue-50" : "hover:bg-gray-50",
                    !alert.isEnabled && "opacity-60"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <IconComponent className="size-5 text-gray-600" />
                      <div>
                        <h4 className="font-semibold text-sm">{alert.title}</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          Predicted {formatTimeUntil(alert.predictedTime)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Badge className={getTypeColor(alert.type)}>
                        {alert.type.replace('_', ' ')}
                      </Badge>
                      
                      <div className={cn(
                        "px-2 py-1 rounded-full text-xs font-medium",
                        getSeverityColor(alert.severity)
                      )}>
                        {alert.severity}
                      </div>

                      <div className="flex items-center gap-1">
                        <Progress value={alert.confidence} className="w-16 h-2" />
                        <span className="text-xs text-muted-foreground w-8">
                          {alert.confidence}%
                        </span>
                      </div>

                      <Switch
                        checked={alert.isEnabled}
                        onCheckedChange={() => toggleAlert(alert.id)}
                      />
                    </div>
                  </div>

                  <div className="mt-3 text-sm text-muted-foreground">
                    {alert.description}
                  </div>

                  {alert.isEnabled && (
                    <div className="mt-3 space-y-2">
                      <div>
                        <h5 className="text-xs font-medium text-gray-700 mb-1">Affected Components</h5>
                        <div className="flex flex-wrap gap-1">
                          {alert.affectedComponents.map((component) => (
                            <Badge key={component} variant="outline" className="text-xs">
                              {component}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h5 className="text-xs font-medium text-gray-700 mb-1">Preventive Actions</h5>
                        <ul className="space-y-1">
                          {alert.preventiveActions.slice(0, 3).map((action, index) => (
                            <li key={index} className="text-xs text-muted-foreground flex items-start gap-2">
                              <div className="size-1.5 bg-green-600 rounded-full mt-1.5 flex-shrink-0" />
                              {action}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        <Button size="sm" className="flex items-center gap-1">
                          <IconCheck className="size-3" />
                          Execute Actions
                        </Button>
                        <Button size="sm" variant="outline">
                          <IconEye className="size-3 mr-1" />
                          View Details
                        </Button>
                        <Button size="sm" variant="outline">
                          <IconSlash className="size-3 mr-1" />
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Model Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconGraph className="size-5" />
            Prediction Model Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">94.2%</div>
              <div className="text-sm text-muted-foreground">Accuracy Rate</div>
            </div>
            
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">12.3s</div>
              <div className="text-sm text-muted-foreground">Avg Prediction Time</div>
            </div>
            
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">2.1%</div>
              <div className="text-sm text-muted-foreground">False Positive Rate</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}