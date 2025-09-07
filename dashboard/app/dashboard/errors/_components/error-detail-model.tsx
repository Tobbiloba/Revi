'use client';

import { useState } from "react";
import { useNotifications } from "@/components/ui/notification-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    IconAlertCircle,
    IconExternalLink,
    IconCopy,
} from "@tabler/icons-react";
import { ErrorWithSession } from "@/lib/revi-api";
import Link from "next/link";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";


const getStatusBadge = (status?: string) => {
    switch (status) {
        case 'resolved':
            return { variant: 'secondary' as const, className: 'bg-green-100/50 dark:bg-green-500/10 text-green-800 dark:text-green-400 border-green-200 dark:border-green-700 backdrop-blur-sm' };
        case 'investigating':
            return { variant: 'secondary' as const, className: 'bg-yellow-100/50 dark:bg-yellow-500/10 text-yellow-800 dark:text-yellow-400 border-yellow-200 dark:border-yellow-700 backdrop-blur-sm' };
        case 'ignored':
            return { variant: 'secondary' as const, className: 'bg-gray-100/50 dark:bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 backdrop-blur-sm' };
        case 'new':
        default:
            return { variant: 'destructive' as const, className: 'bg-red-500/20 dark:bg-red-500/20 backdrop-blur-sm border-red-200 dark:border-red-700' };
    }
};

const ErrorDetailModal = ({
    error,
    onClose,
    onStatusUpdate
}: {
    error: ErrorWithSession;
    onClose: () => void;
    onStatusUpdate: (errorId: number, data: { status: 'new' | 'investigating' | 'resolved' | 'ignored'; resolution_notes?: string }) => void;
}) => {
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const [newStatus, setNewStatus] = useState<'new' | 'investigating' | 'resolved' | 'ignored'>(error.status || 'new');
    const [resolutionNotes, setResolutionNotes] = useState(error.resolution_notes || '');
    const { addNotification } = useNotifications();

    const handleStatusUpdate = () => {
        setIsUpdatingStatus(true);
        onStatusUpdate(error.id, {
            status: newStatus,
            resolution_notes: resolutionNotes || undefined
        });
    };

    const handleCopy = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        addNotification({
            type: 'success',
            title: 'Copied to Clipboard',
            message: `${label} has been copied to your clipboard`,
            duration: 2000
        });
    };
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border-0 shadow-2xl">
                <CardHeader className="border-b">
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <CardTitle className="flex items-center gap-2 mb-2">
                                <IconAlertCircle className="size-5 text-destructive" />
                                Error #{error.id}
                                {(() => {
                                    const statusBadge = getStatusBadge(error.status || 'new');
                                    return (
                                        <Badge
                                            variant={statusBadge.variant}
                                            className={`text-xs capitalize ${statusBadge.className}`}
                                        >
                                            {error.status || 'new'}
                                        </Badge>
                                    );
                                })()}
                            </CardTitle>
                            <p className="text-sm text-gray-600 dark:text-gray-400 font-light">
                                {new Date(error.timestamp).toLocaleString()}
                            </p>

                            {/* Status Management */}
                            <div className="flex items-center gap-4 mt-4">
                                <div className="flex items-center gap-2">
                                    <label className="text-sm font-normal text-gray-700 dark:text-gray-300">Status:</label>
                                    <Select value={newStatus} onValueChange={(value) => setNewStatus(value as 'new' | 'investigating' | 'resolved' | 'ignored')}>
                                        <SelectTrigger className="w-32 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-gray-200 dark:border-gray-700">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border-gray-200 dark:border-gray-700">
                                            <SelectItem value="new">New</SelectItem>
                                            <SelectItem value="investigating">Investigating</SelectItem>
                                            <SelectItem value="resolved">Resolved</SelectItem>
                                            <SelectItem value="ignored">Ignored</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <Button
                                    onClick={handleStatusUpdate}
                                    size="sm"
                                    disabled={isUpdatingStatus || newStatus === (error.status || 'new')}
                                >
                                    {isUpdatingStatus ? 'Updating...' : 'Update Status'}
                                </Button>
                            </div>

                            {(newStatus === 'resolved' || newStatus === 'ignored') && (
                                <div className="mt-3">
                                    <label className="text-sm font-normal mb-2 block text-gray-700 dark:text-gray-300">Resolution Notes:</label>
                                    <Textarea
                                        placeholder="Add notes about the resolution..."
                                        value={resolutionNotes}
                                        onChange={(e) => setResolutionNotes(e.target.value)}
                                        className="text-sm"
                                        rows={3}
                                    />
                                </div>
                            )}
                        </div>

                        <Button variant="ghost" size="sm" onClick={onClose}>
                            ×
                        </Button>
                    </div>
                </CardHeader>

                <CardContent className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                    <div className="space-y-6">
                        <div>
                            <h4 className="font-normal mb-2 text-gray-800 dark:text-gray-200">Error Message</h4>
                            <p className="text-sm bg-gray-100/30 dark:bg-gray-700/30 p-3 rounded break-words text-gray-700 dark:text-gray-300 font-light">
                                {error.message}
                            </p>
                        </div>

                        {error.stack_trace && (
                            <div>
                                <h4 className="font-normal mb-2 text-gray-800 dark:text-gray-200">Stack Trace</h4>
                                <pre className="text-xs bg-gray-100/30 dark:bg-gray-700/30 p-3 rounded overflow-x-auto whitespace-pre-wrap text-gray-700 dark:text-gray-300 font-light">
                                    {error.stack_trace}
                                </pre>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {error.url && (
                                <div>
                                    <h4 className="font-normal mb-2 text-gray-800 dark:text-gray-200">URL</h4>
                                    <p className="text-sm bg-gray-100/30 dark:bg-gray-700/30 p-3 rounded font-mono break-all text-gray-700 dark:text-gray-300 font-light">
                                        {error.url}
                                    </p>
                                </div>
                            )}

                            {error.user_agent && (
                                <div>
                                    <h4 className="font-normal mb-2 text-gray-800 dark:text-gray-200">User Agent</h4>
                                    <p className="text-xs bg-gray-100/30 dark:bg-gray-700/30 p-3 rounded break-words text-gray-700 dark:text-gray-300 font-light">
                                        {error.user_agent}
                                    </p>
                                </div>
                            )}
                        </div>

                        {error.session_id && (
                            <div>
                                <h4 className="font-normal mb-2 text-gray-800 dark:text-gray-200">Session Information</h4>
                                <div className="bg-muted p-3 rounded space-y-2">
                                    <p className="text-sm">
                                        <span className="font-medium">Session ID:</span> {error.session_id}
                                    </p>
                                    {error.session_user_id && (
                                        <p className="text-sm">
                                            <span className="font-medium">User ID:</span> {error.session_user_id}
                                        </p>
                                    )}
                                    <Link
                                        href={`/dashboard/sessions/${error.session_id}`}
                                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                                    >
                                        <IconExternalLink className="size-3" />
                                        View Full Session Timeline
                                    </Link>
                                </div>
                            </div>
                        )}

                        {/* Error Context & Environment */}
                        <div>
                            <h4 className="font-normal mb-2 text-gray-800 dark:text-gray-200">Error Context</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Browser Information */}
                                {error.user_agent && (
                                    <div className="space-y-2">
                                        <h5 className="font-medium text-sm">Browser Details</h5>
                                        <div className="bg-muted p-3 rounded text-xs">
                                            <div className="space-y-1">
                                                <div><span className="font-medium">User Agent:</span></div>
                                                <div className="font-mono break-all">{error.user_agent}</div>
                                                {(() => {
                                                    const ua = error.user_agent;
                                                    const browserMatch = ua.match(/(Chrome|Firefox|Safari|Edge)\/([0-9.]+)/);
                                                    const osMatch = ua.match(/\(([^)]+)\)/);
                                                    return (
                                                        <div className="mt-2 space-y-1">
                                                            {browserMatch && (
                                                                <div><span className="font-medium">Browser:</span> {browserMatch[1]} {browserMatch[2]}</div>
                                                            )}
                                                            {osMatch && (
                                                                <div><span className="font-medium">OS:</span> {osMatch[1]}</div>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Error Frequency */}
                                <div className="space-y-2">
                                    <h5 className="font-medium text-sm">Error Pattern</h5>
                                    <div className="bg-muted p-3 rounded text-xs space-y-1">
                                        <div><span className="font-medium">First Occurrence:</span> {new Date(error.timestamp).toLocaleString()}</div>
                                        <div><span className="font-medium">Error ID:</span> #{error.id}</div>
                                        <div><span className="font-medium">Project:</span> #{error.project_id}</div>
                                        {error.session_id && (
                                            <div><span className="font-medium">Session Context:</span> Available</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Debug Breadcrumbs */}
                        <div>
                            <h4 className="font-normal mb-2 text-gray-800 dark:text-gray-200">Debug Information</h4>
                            <div className="space-y-3">
                                {/* Error Location Breadcrumb */}
                                {error.stack_trace && (
                                    <div>
                                        <h5 className="font-medium text-sm mb-2">Error Location</h5>
                                        <div className="bg-muted/50 border-l-4 border-destructive p-3 rounded-r">
                                            {(() => {
                                                const firstLine = error.stack_trace.split('\\n')[0];
                                                const locationMatch = firstLine.match(/at (.+) \\((.+):([0-9]+):([0-9]+)\\)/);
                                                if (locationMatch) {
                                                    return (
                                                        <div className="text-sm space-y-1">
                                                            <div className="font-mono"><span className="font-medium">Function:</span> {locationMatch[1]}</div>
                                                            <div className="font-mono"><span className="font-medium">File:</span> {locationMatch[2]}</div>
                                                            <div className="font-mono"><span className="font-medium">Line:</span> {locationMatch[3]}:{locationMatch[4]}</div>
                                                        </div>
                                                    );
                                                } else {
                                                    return <div className="text-sm font-mono">{firstLine}</div>;
                                                }
                                            })()}
                                        </div>
                                    </div>
                                )}

                                {/* Page Context */}
                                {error.url && (
                                    <div>
                                        <h5 className="font-medium text-sm mb-2">Page Context</h5>
                                        <div className="bg-muted/50 border-l-4 border-blue-500 p-3 rounded-r">
                                            <div className="text-sm space-y-1">
                                                <div><span className="font-medium">URL:</span></div>
                                                <div className="font-mono break-all">{error.url}</div>
                                                {(() => {
                                                    try {
                                                        const url = new URL(error.url);
                                                        return (
                                                            <div className="mt-2 space-y-1">
                                                                <div><span className="font-medium">Domain:</span> {url.hostname}</div>
                                                                <div><span className="font-medium">Path:</span> {url.pathname}</div>
                                                                {url.search && <div><span className="font-medium">Query:</span> {url.search}</div>}
                                                                {url.hash && <div><span className="font-medium">Hash:</span> {url.hash}</div>}
                                                            </div>
                                                        );
                                                    } catch {
                                                        return null;
                                                    }
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Similar Errors Hint */}
                                <div>
                                    <h5 className="font-medium text-sm mb-2">Investigation Hints</h5>
                                    <div className="bg-blue-50 border border-blue-200 p-3 rounded">
                                        <div className="text-sm space-y-2">
                                            <div className="flex items-start gap-2">
                                                <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0" />
                                                <div>
                                                    <span className="font-medium">Related Errors:</span> Search for similar error messages in your logs
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-2">
                                                <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0" />
                                                <div>
                                                    <span className="font-medium">User Impact:</span> {error.session_id ? 'User session affected - check timeline' : 'No user session data available'}
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-2">
                                                <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0" />
                                                <div>
                                                    <span className="font-medium">Browser Compatibility:</span> {error.user_agent ? 'Check if error is browser-specific' : 'No browser information available'}
                                                </div>
                                            </div>
                                            {error.url && (
                                                <div className="flex items-start gap-2">
                                                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0" />
                                                    <div>
                                                        <span className="font-medium">Page Analysis:</span> Test the affected page manually for reproduction
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Action Items */}
                        <div>
                            <h4 className="font-normal mb-2 text-gray-800 dark:text-gray-200">Quick Actions</h4>
                            <div className="flex flex-wrap gap-2">
                                {error.session_id && (
                                    <Link href={`/dashboard/sessions/${error.session_id}`}>
                                        <Button variant="outline" size="sm">
                                            <IconExternalLink className="size-4 mr-2" />
                                            View Session Timeline
                                        </Button>
                                    </Link>
                                )}
                                {error.url && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => window.open(error.url, '_blank')}
                                    >
                                        <IconExternalLink className="size-4 mr-2" />
                                        Open Error Page
                                    </Button>
                                )}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleCopy(JSON.stringify({
                                        id: error.id,
                                        message: error.message,
                                        url: error.url,
                                        timestamp: error.timestamp,
                                        stack_trace: error.stack_trace
                                    }, null, 2), 'Error details')}
                                >
                                    <IconCopy className="size-4 mr-2" />
                                    Copy Error Details
                                </Button>
                                <Button variant="outline" size="sm">
                                    <IconAlertCircle className="size-4 mr-2" />
                                    Search Similar Errors
                                </Button>
                            </div>
                        </div>

                        {Object.keys(error.metadata || {}).length > 0 && (
                            <div>
                                <h4 className="font-normal mb-2 text-gray-800 dark:text-gray-200">Additional Metadata</h4>
                                <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
                                    {JSON.stringify(error.metadata, null, 2)}
                                </pre>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export {
    ErrorDetailModal
}