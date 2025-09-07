// 'use client';

// import React, { useState, useMemo } from 'react';
// import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// import { Badge } from '@/components/ui/badge';
// import { Button } from '@/components/ui/button';
// import { Input } from '@/components/ui/input';
// import { Textarea } from '@/components/ui/textarea';
// import { 
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from '@/components/ui/select';
// import { 
//   Dialog,
//   DialogContent,
//   DialogDescription,
//   DialogHeader,
//   DialogTitle,
//   DialogTrigger,
// } from '@/components/ui/dialog';
// import { 
//   IconTarget,
//   IconUsers,
//   IconMerge,
//   IconTag,
//   IconBulb,
//   IconDownload,
//   IconBell,
//   IconCalendar,
//   IconSettings,
//   IconX,
//   IconCheck,
//   IconAlertTriangle
// } from '@tabler/icons-react';
// import { Separator } from '@/components/ui/separator';
// import { Checkbox } from '@/components/ui/checkbox';
// import { ErrorWithSession } from '@/lib/revi-api';
// import { cn } from '@/lib/utils';

// interface BulkOperationsPanelProps {
//   selectedErrors: Set<number>;
//   errors: ErrorWithSession[];
//   onBulkStatusUpdate: (status: 'investigating' | 'resolved' | 'ignored', notes?: string) => Promise<void>;
//   onClearSelection: () => void;
//   onBulkAssign?: (assignee: string, errors: number[]) => Promise<void>;
//   onBulkTag?: (tags: string[], errors: number[]) => Promise<void>;
//   onBulkMerge?: (errors: number[]) => Promise<void>;
//   className?: string;
// }

// interface TeamMember {
//   id: string;
//   name: string;
//   email: string;
//   avatar?: string;
//   role: string;
//   workload: number; // 0-100
// }

// interface BulkAction {
//   id: string;
//   label: string;
//   icon: React.ReactNode;
//   description: string;
//   requiresInput?: boolean;
//   inputType?: 'text' | 'textarea' | 'select' | 'multiselect';
//   options?: Array<{ value: string; label: string }>;
//   confirmationRequired?: boolean;
//   severity?: 'default' | 'warning' | 'destructive';
// }

// export function BulkOperationsPanel({
//   selectedErrors,
//   errors,
//   onBulkStatusUpdate,
//   onClearSelection,
//   onBulkAssign,
//   onBulkTag,
//   onBulkMerge,
//   className
// }: BulkOperationsPanelProps) {
//   const [isProcessing, setIsProcessing] = useState(false);
//   const [selectedAction, setSelectedAction] = useState<BulkAction | null>(null);
//   const [actionInput, setActionInput] = useState<string>('');
//   const [selectedTags, setSelectedTags] = useState<string[]>([]);
//   const [selectedAssignee, setSelectedAssignee] = useState<string>('');
//   const [showAdvanced, setShowAdvanced] = useState(false);
//   const [scheduleDate, setScheduleDate] = useState<string>('');

//   // Mock team members data (would come from API)
//   const teamMembers: TeamMember[] = [
//     { id: '1', name: 'Alice Johnson', email: 'alice@company.com', role: 'Senior Developer', workload: 75 },
//     { id: '2', name: 'Bob Smith', email: 'bob@company.com', role: 'Frontend Lead', workload: 60 },
//     { id: '3', name: 'Carol Davis', email: 'carol@company.com', role: 'Backend Developer', workload: 40 },
//     { id: '4', name: 'David Wilson', email: 'david@company.com', role: 'DevOps Engineer', workload: 85 },
//   ];

//   const commonTags = [
//     'bug', 'feature-request', 'ui-issue', 'performance', 'security', 
//     'mobile', 'desktop', 'critical', 'needs-investigation', 'duplicate'
//   ];

//   // Selected errors data
//   const selectedErrorsData = useMemo(() => {
//     return errors.filter(error => selectedErrors.has(error.id));
//   }, [errors, selectedErrors]);

//   // Analytics for selected errors
//   const selectionAnalytics = useMemo(() => {
//     const severities = { critical: 0, high: 0, medium: 0, low: 0 };
//     const statuses = { new: 0, investigating: 0, resolved: 0, ignored: 0 };
//     const browsers = new Map<string, number>();
//     const urls = new Map<string, number>();
//     const users = new Set<string>();

//     selectedErrorsData.forEach(error => {
//       // Count severities
//       const severity = error.metadata?.severity || 'medium';
//       if (severity in severities) severities[severity as keyof typeof severities]++;

//       // Count statuses
//       const status = error.status || 'new';
//       if (status in statuses) statuses[status as keyof typeof statuses]++;

//       // Count browsers
//       const browser = extractBrowser(error.user_agent || '');
//       browsers.set(browser, (browsers.get(browser) || 0) + 1);

//       // Count URLs
//       if (error.url) {
//         urls.set(error.url, (urls.get(error.url) || 0) + 1);
//       }

//       // Count unique users
//       if (error.session_user_id) {
//         users.add(error.session_user_id);
//       }
//     });

//     return {
//       severities,
//       statuses,
//       topBrowsers: Array.from(browsers.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3),
//       topUrls: Array.from(urls.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3),
//       uniqueUsers: users.size,
//       timeRange: getTimeRange(selectedErrorsData)
//     };
//   }, [selectedErrorsData]);

//   const bulkActions: BulkAction[] = [
//     {
//       id: 'resolve',
//       label: 'Mark as Resolved',
//       icon: <IconCheck className="size-4" />,
//       description: 'Mark selected errors as resolved with optional resolution notes',
//       requiresInput: true,
//       inputType: 'textarea',
//       severity: 'default'
//     },
//     {
//       id: 'investigate',
//       label: 'Start Investigation',
//       icon: <IconBulb className="size-4" />,
//       description: 'Mark errors as under investigation',
//       severity: 'default'
//     },
//     {
//       id: 'ignore',
//       label: 'Ignore Errors',
//       icon: <IconX className="size-4" />,
//       description: 'Mark errors as ignored (they will be hidden from active views)',
//       confirmationRequired: true,
//       severity: 'warning'
//     },
//     {
//       id: 'assign',
//       label: 'Assign to Team Member',
//       icon: <IconUsers className="size-4" />,
//       description: 'Assign errors to a specific team member',
//       requiresInput: true,
//       inputType: 'select',
//       options: teamMembers.map(member => ({ 
//         value: member.id, 
//         label: `${member.name} (${member.workload}% capacity)` 
//       }))
//     },
//     {
//       id: 'tag',
//       label: 'Add Tags',
//       icon: <IconTag className="size-4" />,
//       description: 'Add tags to categorize and organize errors',
//       requiresInput: true,
//       inputType: 'multiselect'
//     },
//     {
//       id: 'merge',
//       label: 'Merge Similar',
//       icon: <IconMerge className="size-4" />,
//       description: 'Merge similar errors into a single group',
//       confirmationRequired: true,
//       severity: 'warning'
//     },
//     {
//       id: 'export',
//       label: 'Export Data',
//       icon: <IconDownload className="size-4" />,
//       description: 'Export selected errors to CSV or JSON format',
//       requiresInput: true,
//       inputType: 'select',
//       options: [
//         { value: 'csv', label: 'CSV Format' },
//         { value: 'json', label: 'JSON Format' },
//         { value: 'pdf', label: 'PDF Report' }
//       ]
//     },
//     {
//       id: 'notify',
//       label: 'Send Notifications',
//       icon: <IconBell className="size-4" />,
//       description: 'Send notifications about these errors to team members',
//       requiresInput: true,
//       inputType: 'multiselect'
//     }
//   ];

//   const extractBrowser = (userAgent: string): string => {
//     if (userAgent.includes('Chrome')) return 'Chrome';
//     if (userAgent.includes('Firefox')) return 'Firefox';
//     if (userAgent.includes('Safari')) return 'Safari';
//     if (userAgent.includes('Edge')) return 'Edge';
//     return 'Unknown';
//   };

//   const getTimeRange = (errors: ErrorWithSession[]): string => {
//     if (errors.length === 0) return 'No time range';
    
//     const timestamps = errors.map(e => new Date(e.timestamp).getTime());
//     const min = Math.min(...timestamps);
//     const max = Math.max(...timestamps);
//     const diffHours = (max - min) / (1000 * 60 * 60);
    
//     if (diffHours < 1) return 'Within last hour';
//     if (diffHours < 24) return `Over ${Math.round(diffHours)} hours`;
//     return `Over ${Math.round(diffHours / 24)} days`;
//   };

//   const handleBulkAction = async (action: BulkAction) => {
//     if (!selectedErrors.size) return;

//     setIsProcessing(true);
//     try {
//       switch (action.id) {
//         case 'resolve':
//           await onBulkStatusUpdate('resolved', actionInput);
//           break;
//         case 'investigate':
//           await onBulkStatusUpdate('investigating');
//           break;
//         case 'ignore':
//           await onBulkStatusUpdate('ignored', actionInput);
//           break;
//         case 'assign':
//           if (selectedAssignee && onBulkAssign) {
//             await onBulkAssign(selectedAssignee, Array.from(selectedErrors));
//           }
//           break;
//         case 'tag':
//           if (selectedTags.length && onBulkTag) {
//             await onBulkTag(selectedTags, Array.from(selectedErrors));
//           }
//           break;
//         case 'merge':
//           if (onBulkMerge) {
//             await onBulkMerge(Array.from(selectedErrors));
//           }
//           break;
//         case 'export':
//           handleExport(actionInput);
//           break;
//         case 'notify':
//           handleNotifications();
//           break;
//       }
      
//       // Reset state
//       setSelectedAction(null);
//       setActionInput('');
//       setSelectedTags([]);
//       setSelectedAssignee('');
//     } catch (error) {
//       console.error('Bulk action failed:', error);
//     } finally {
//       setIsProcessing(false);
//     }
//   };

//   const handleExport = (format: string) => {
//     const data = selectedErrorsData.map(error => ({
//       id: error.id,
//       message: error.message,
//       timestamp: error.timestamp,
//       url: error.url,
//       status: error.status || 'new',
//       severity: error.metadata?.severity || 'medium',
//       user_agent: error.user_agent,
//       session_id: error.session_id
//     }));

//     let content: string;
//     let mimeType: string;
//     let filename: string;

//     switch (format) {
//       case 'csv':
//         content = convertToCSV(data);
//         mimeType = 'text/csv';
//         filename = `errors-${Date.now()}.csv`;
//         break;
//       case 'json':
//         content = JSON.stringify(data, null, 2);
//         mimeType = 'application/json';
//         filename = `errors-${Date.now()}.json`;
//         break;
//       default:
//         return;
//     }

//     const blob = new Blob([content], { type: mimeType });
//     const url = URL.createObjectURL(blob);
//     const a = document.createElement('a');
//     a.href = url;
//     a.download = filename;
//     document.body.appendChild(a);
//     a.click();
//     document.body.removeChild(a);
//     URL.revokeObjectURL(url);
//   };

//   const convertToCSV = (data: Record<string, unknown>[]): string => {
//     if (data.length === 0) return '';
    
//     const headers = Object.keys(data[0]);
//     const csvContent = [
//       headers.join(','),
//       ...data.map(row => headers.map(header => JSON.stringify(row[header] || '')).join(','))
//     ].join('\n');
    
//     return csvContent;
//   };

//   const handleNotifications = () => {
//     // Implementation for sending notifications
//     console.log('Sending notifications for errors:', selectedErrors);
//   };

//   if (selectedErrors.size === 0) return null;

//   return (
//     <Card className={cn("border-blue-200 bg-blue-50/30 dark:bg-blue-950/20", className)}>
//       <CardHeader className="pb-3">
//         <div className="flex items-center justify-between">
//           <CardTitle className="flex items-center gap-2">
//             <IconTarget className="size-5 text-blue-600" />
//             Bulk Operations
//             <Badge variant="default" className="bg-blue-600">
//               {selectedErrors.size} selected
//             </Badge>
//           </CardTitle>
          
//           <div className="flex items-center gap-2">
//             <Button
//               variant="outline"
//               size="sm"
//               onClick={() => setShowAdvanced(!showAdvanced)}
//             >
//               <IconSettings className="size-4 mr-2" />
//               {showAdvanced ? 'Simple' : 'Advanced'}
//             </Button>
//             <Button
//               variant="ghost"
//               size="sm"
//               onClick={onClearSelection}
//             >
//               <IconX className="size-4 mr-2" />
//               Clear Selection
//             </Button>
//           </div>
//         </div>
//       </CardHeader>
      
//       <CardContent className="space-y-4">
//         {/* Selection Analytics */}
//         <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-3 bg-white rounded-lg border">
//           <div className="text-center">
//             <div className="text-sm font-medium text-gray-600">Severity</div>
//             <div className="flex justify-center gap-1 mt-1">
//               {Object.entries(selectionAnalytics.severities).map(([severity, count]) => (
//                 count > 0 && (
//                   <Badge 
//                     key={severity} 
//                     variant="outline" 
//                     className={`text-xs ${
//                       severity === 'critical' ? 'text-red-600 border-red-200' :
//                       severity === 'high' ? 'text-orange-600 border-orange-200' :
//                       severity === 'medium' ? 'text-yellow-600 border-yellow-200' :
//                       'text-green-600 border-green-200'
//                     }`}
//                   >
//                     {severity}: {count}
//                   </Badge>
//                 )
//               ))}
//             </div>
//           </div>
          
//           <div className="text-center">
//             <div className="text-sm font-medium text-gray-600">Users Affected</div>
//             <div className="text-lg font-semibold text-blue-600">
//               {selectionAnalytics.uniqueUsers}
//             </div>
//           </div>
          
//           <div className="text-center">
//             <div className="text-sm font-medium text-gray-600">Time Range</div>
//             <div className="text-xs text-gray-600">
//               {selectionAnalytics.timeRange}
//             </div>
//           </div>
          
//           <div className="text-center">
//             <div className="text-sm font-medium text-gray-600">Top URL</div>
//             <div className="text-xs text-gray-600 truncate">
//               {selectionAnalytics.topUrls[0]?.[0] || 'Various URLs'}
//             </div>
//           </div>
//         </div>

//         {/* Quick Actions */}
//         <div className="flex flex-wrap gap-2">
//           {bulkActions.slice(0, showAdvanced ? bulkActions.length : 4).map(action => (
//             <Dialog key={action.id}>
//               <DialogTrigger asChild>
//                 <Button
//                   variant={action.severity === 'destructive' ? 'destructive' : 'outline'}
//                   size="sm"
//                   className={cn(
//                     "flex items-center gap-2",
//                     action.severity === 'warning' && "border-orange-200 text-orange-700 hover:bg-orange-50"
//                   )}
//                   onClick={() => setSelectedAction(action)}
//                 >
//                   {action.icon}
//                   {action.label}
//                 </Button>
//               </DialogTrigger>
              
//               <DialogContent className="max-w-md">
//                 <DialogHeader>
//                   <DialogTitle className="flex items-center gap-2">
//                     {action.icon}
//                     {action.label}
//                   </DialogTitle>
//                   <DialogDescription>
//                     {action.description}
//                   </DialogDescription>
//                 </DialogHeader>
                
//                 <div className="space-y-4">
//                   {/* Action-specific inputs */}
//                   {action.requiresInput && (
//                     <div className="space-y-2">
//                       {action.inputType === 'textarea' && (
//                         <Textarea
//                           placeholder="Add notes or resolution details..."
//                           value={actionInput}
//                           onChange={(e) => setActionInput(e.target.value)}
//                           rows={3}
//                         />
//                       )}
                      
//                       {action.inputType === 'select' && action.options && (
//                         <Select 
//                           value={action.id === 'assign' ? selectedAssignee : actionInput} 
//                           onValueChange={action.id === 'assign' ? setSelectedAssignee : setActionInput}
//                         >
//                           <SelectTrigger>
//                             <SelectValue placeholder="Select an option..." />
//                           </SelectTrigger>
//                           <SelectContent>
//                             {action.options.map(option => (
//                               <SelectItem key={option.value} value={option.value}>
//                                 {option.label}
//                               </SelectItem>
//                             ))}
//                           </SelectContent>
//                         </Select>
//                       )}
                      
//                       {action.inputType === 'multiselect' && action.id === 'tag' && (
//                         <div className="space-y-2">
//                           <div className="text-sm font-medium">Select tags:</div>
//                           <div className="flex flex-wrap gap-2">
//                             {commonTags.map(tag => (
//                               <Button
//                                 key={tag}
//                                 variant={selectedTags.includes(tag) ? "default" : "outline"}
//                                 size="sm"
//                                 onClick={() => {
//                                   setSelectedTags(prev => 
//                                     prev.includes(tag) 
//                                       ? prev.filter(t => t !== tag)
//                                       : [...prev, tag]
//                                   );
//                                 }}
//                               >
//                                 {tag}
//                               </Button>
//                             ))}
//                           </div>
//                         </div>
//                       )}
//                     </div>
//                   )}

//                   {/* Confirmation message for destructive actions */}
//                   {action.confirmationRequired && (
//                     <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
//                       <div className="flex items-center gap-2 text-orange-800">
//                         <IconAlertTriangle className="size-4" />
//                         <span className="text-sm font-medium">Are you sure?</span>
//                       </div>
//                       <p className="text-sm text-orange-700 mt-1">
//                         This action will affect {selectedErrors.size} errors and cannot be easily undone.
//                       </p>
//                     </div>
//                   )}

//                   {/* Action buttons */}
//                   <div className="flex items-center justify-end gap-2 pt-2">
//                     <Button
//                       variant="outline"
//                       onClick={() => setSelectedAction(null)}
//                     >
//                       Cancel
//                     </Button>
//                     <Button
//                       onClick={() => selectedAction && handleBulkAction(selectedAction)}
//                       disabled={isProcessing}
//                       variant={action.severity === 'destructive' ? 'destructive' : 'default'}
//                     >
//                       {isProcessing ? 'Processing...' : 'Confirm'}
//                     </Button>
//                   </div>
//                 </div>
//               </DialogContent>
//             </Dialog>
//           ))}
//         </div>

//         {/* Advanced options */}
//         {showAdvanced && (
//           <div className="border-t pt-4 space-y-3">
//             <div className="flex items-center gap-2">
//               <IconCalendar className="size-4 text-gray-600" />
//               <span className="text-sm font-medium">Schedule for later:</span>
//               <Input
//                 type="datetime-local"
//                 value={scheduleDate}
//                 onChange={(e) => setScheduleDate(e.target.value)}
//                 className="w-auto"
//               />
//             </div>
            
//             <div className="flex items-center gap-4">
//               <label className="flex items-center gap-2 text-sm">
//                 <Checkbox />
//                 Send email notifications
//               </label>
//               <label className="flex items-center gap-2 text-sm">
//                 <Checkbox />
//                 Create Slack notifications
//               </label>
//               <label className="flex items-center gap-2 text-sm">
//                 <Checkbox />
//                 Update external ticketing system
//               </label>
//             </div>
//           </div>
//         )}
//       </CardContent>
//     </Card>
//   );
// }