'use client'
import { Activity, Bug, MessageCircle } from 'lucide-react'
import DottedMap from 'dotted-map'
import { Area, AreaChart, CartesianGrid } from 'recharts'
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'

export default function FeaturesSection() {
    return (
        <section id="features" className="px-4 py-16 md:py-32">
            <div className="mx-auto grid max-w-7xl border-[.1px] border-white/10 rounded-xl md:grid-cols-2">
                <div className='bg-gradient-to-br from-white/10 via-transparent to-white/30'>
                    <div className="p-6 sm:p-12">
                        <span className="text-muted-foreground flex items-center gap-2">
                            <Bug className="size-4" />
                            Real time error tracking
                        </span>

                        <p className="mt-8 text-2xl font-semibold">Advanced error monitoring system. Instantly detect and resolve issues.</p>
                    </div>

                    <div
                        aria-hidden
                        className="relative">
                        {/* Multiple Error Notifications */}
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2">
                            {/* Main Error Alert */}
                            <div className="rounded-(--radius) bg-background z-1 dark:bg-muted relative flex size-fit w-fit items-center gap-2 border px-3 py-1 text-xs font-medium shadow-md shadow-zinc-950/5 animate-pulse">
                                <span className="text-lg animate-bounce">🚨</span> Critical: Database timeout in EU-West
                            </div>
                            
                            {/* Secondary Alerts */}
                            <div className="flex gap-2 text-xs">
                                <div className="rounded-(--radius) bg-background dark:bg-muted flex items-center gap-1 border px-2 py-1 shadow-sm hover:shadow-md transition-shadow duration-200">
                                    <span className="text-sm animate-pulse">🟡</span> API rate limit exceeded
                                </div>
                                <div className="rounded-(--radius) bg-background dark:bg-muted flex items-center gap-1 border px-2 py-1 shadow-sm hover:shadow-md transition-shadow duration-200">
                                    <span className="text-sm animate-pulse">🔵</span> Memory leak detected
                                </div>
                            </div>
                        </div>

                        <div className="relative overflow-hidden">
                            <div className="bg-radial z-1 to-background absolute inset-0 from-transparent to-75%"></div>
                            <EnhancedMap />
                        </div>
                    </div>
                </div>
                <div className="overflow-hidden border-t-[.1px] border-white/10 bg-zinc-50 p-6 sm:p-12 md:border-0 md:border-l dark:bg-transparent">
                    <div className="relative z-10">
                        <span className="text-muted-foreground flex items-center gap-2">
                            <MessageCircle className="size-4" />
                            Session replay & debugging
                        </span>

                        <p className="my-8 text-2xl font-semibold">See exactly what users experienced when errors occurred.</p>
                    </div>
                    <div
                        aria-hidden
                        className="flex flex-col gap-3 space-y-1 h-[20rem] overflow-y-scroll overflow-x-hidden">
                        {/* Page Load */}
                        <div className="group hover:bg-white/5 p-2 -m-2 rounded-lg transition-colors duration-200">
                            <div className="flex items-center gap-2">
                                <span className="flex size-5 rounded-full border bg-green-100">
                                    <span className="text-xs m-auto">🌐</span>
                                </span>
                                <span className="text-muted-foreground text-xs">2:33 PM</span>
                            </div>
                            <div className="rounded-(--radius) bg-background mt-1.5 w-3/4 border p-2 text-xs">Page loaded: /dashboard/profile</div>
                        </div>

                        {/* User Navigation */}
                        <div className="group hover:bg-white/5 p-2 -m-2 rounded-lg transition-colors duration-200">
                            <div className="flex items-center gap-2">
                                <span className="flex size-5 rounded-full border bg-blue-100">
                                    <span className="text-xs m-auto">👤</span>
                                </span>
                                <span className="text-muted-foreground text-xs">2:34 PM</span>
                            </div>
                            <div className="rounded-(--radius) bg-background mt-1.5 w-4/5 border p-2 text-xs">User navigated to settings tab</div>
                        </div>

                        {/* Form Interaction */}
                        <div className="group hover:bg-white/5 p-2 -m-2 rounded-lg transition-colors duration-200">
                            <div className="flex items-center gap-2">
                                <span className="flex size-5 rounded-full border bg-blue-100">
                                    <span className="text-xs m-auto">✏️</span>
                                </span>
                                <span className="text-muted-foreground text-xs">2:34 PM</span>
                            </div>
                            <div className="rounded-(--radius) bg-background mt-1.5 w-3/4 border p-2 text-xs">Input focus: email field</div>
                        </div>

                        {/* Initial Error */}
                        <div className="group hover:bg-red-50/10 p-2 -m-2 rounded-lg transition-colors duration-200">
                            <div className="flex items-center gap-2">
                                <span className="flex size-5 rounded-full border bg-red-100">
                                    <span className="text-xs m-auto">❌</span>
                                </span>
                                <span className="text-muted-foreground text-xs">2:34 PM</span>
                            </div>
                            <div className="rounded-(--radius) bg-background mt-1.5 w-4/5 border p-2 text-xs">TypeError: Cannot read properties of undefined (reading &apos;email&apos;)</div>
                        </div>

                        {/* Stack Trace */}
                        <div className="group hover:bg-orange-50/10 p-2 -m-2 rounded-lg transition-colors duration-200">
                            <div className="flex items-center gap-2">
                                <span className="flex size-5 rounded-full border bg-orange-100">
                                    <span className="text-xs m-auto">📍</span>
                                </span>
                                <span className="text-muted-foreground text-xs">2:34 PM</span>
                            </div>
                            <div className="rounded-(--radius) bg-background mt-1.5 w-4/5 border p-2 text-xs font-mono">
                                at ProfileForm.tsx:42:15<br/>
                                at validateEmail (utils.ts:28:3)
                            </div>
                        </div>

                        {/* Console Error */}
                        <div className="group hover:bg-red-50/10 p-2 -m-2 rounded-lg transition-colors duration-200">
                            <div className="flex items-center gap-2">
                                <span className="flex size-5 rounded-full border bg-red-100">
                                    <span className="text-xs m-auto">🔴</span>
                                </span>
                                <span className="text-muted-foreground text-xs">2:34 PM</span>
                            </div>
                            <div className="rounded-(--radius) bg-background mt-1.5 w-5/6 border p-2 text-xs">
                                Console Error: Uncaught TypeError at line 42
                            </div>
                        </div>

                        {/* User Action */}
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="flex size-5 rounded-full border bg-blue-100">
                                    <span className="text-xs m-auto">👤</span>
                                </span>
                                <span className="text-muted-foreground text-xs">2:35 PM</span>
                            </div>
                            <div className="rounded-(--radius) bg-background mt-1.5 w-3/4 border p-2 text-xs">User clicked &apos;Update Profile&apos; button</div>
                        </div>

                        {/* Network Request */}
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="flex size-5 rounded-full border bg-yellow-100">
                                    <span className="text-xs m-auto">🌐</span>
                                </span>
                                <span className="text-muted-foreground text-xs">2:35 PM</span>
                            </div>
                            <div className="rounded-(--radius) bg-background mt-1.5 w-4/5 border p-2 text-xs">POST /api/user/update failed (500) - 1.2s</div>
                        </div>

                        {/* Session Context */}
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="flex size-5 rounded-full border bg-purple-100">
                                    <span className="text-xs m-auto">🔍</span>
                                </span>
                                <span className="text-muted-foreground text-xs">2:35 PM</span>
                            </div>
                            <div className="rounded-(--radius) bg-background mt-1.5 w-5/6 border p-2 text-xs">
                                Session: usr_12x3...456, Chrome 120, 1920x1080
                            </div>
                        </div>

                        {/* User Retry */}
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="flex size-5 rounded-full border bg-orange-100">
                                    <span className="text-xs m-auto">🔄</span>
                                </span>
                                <span className="text-muted-foreground text-xs">2:35 PM</span>
                            </div>
                            <div className="rounded-(--radius) bg-background mt-1.5 w-3/4 border p-2 text-xs">User attempted retry (3rd attempt)</div>
                        </div>

                        {/* Resolution */}
                        <div>
                            <div className="rounded-(--radius) mb-1 ml-auto w-3/5 bg-emerald-600 p-2 text-xs text-white">Fixed in v1.2.3 - added null checks for user data</div>
                            <span className="text-muted-foreground block text-right text-xs">Now</span>
                        </div>
                    </div>
                </div>
                <div className="col-span-full border-y-[.1px] border-white/10 p-12">
                    <p className="text-center text-4xl font-semibold lg:text-7xl bg-gradient-to-r from-slate-600 via-white to-gray-300 bg-clip-text text-transparent">99.99% Uptime</p>
                </div>
                <div className="relative col-span-full bg-gradient-to-tr from-white/10 via-transparent to-white/30 overflow-hidden">
                    <div className="absolute z-10 max-w-lg px-6 pr-12 pt-6 md:px-12 md:pt-12">
                        <span className="text-muted-foreground flex items-center gap-2">
                            <Activity className="size-4 animate-pulse" />
                            Performance monitoring
                        </span>

                        <p className="my-8 text-2xl font-semibold">
                            Track Core Web Vitals and application performance. <span className="text-muted-foreground"> Optimize user experience in real-time.</span>
                        </p>
                    </div>
                    <div className="hover:scale-[1.02] transition-transform duration-500 ease-out">
                        <MonitoringChart />
                    </div>
                    
                    {/* Subtle background animation */}
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-cyan-500/5 animate-pulse"></div>
                </div>
            </div>
        </section>
    )
}

const map = new DottedMap({ height: 55, grid: 'diagonal' })

const points = map.getPoints()

const svgOptions = {
    backgroundColor: 'var(--color-background)',
    color: 'currentColor',
    radius: 0.15,
}

const EnhancedMap = () => {
    const viewBox = `0 0 120 60`
    
    // Error locations with different types and sizes
    const errorIndicators = [
        { x: 25, y: 20, type: 'critical', color: '#ef4444' }, // US East
        { x: 20, y: 35, type: 'warning', color: '#f59e0b' },  // US West  
        { x: 60, y: 15, type: 'critical', color: '#ef4444' }, // Europe
        { x: 65, y: 25, type: 'info', color: '#3b82f6' },     // Europe Central
        { x: 90, y: 20, type: 'warning', color: '#f59e0b' },  // Asia
        { x: 95, y: 30, type: 'info', color: '#3b82f6' },     // Japan
        { x: 105, y: 35, type: 'critical', color: '#ef4444' }, // Australia
        { x: 40, y: 45, type: 'info', color: '#3b82f6' },     // Brazil
    ]
    
    return (
        <svg
            viewBox={viewBox}
            style={{ background: svgOptions.backgroundColor }}>
            {/* Base map points */}
            {points.map((point, index) => (
                <circle
                    key={index}
                    cx={point.x}
                    cy={point.y}
                    r={svgOptions.radius}
                    fill={svgOptions.color}
                />
            ))}
            
            {/* Error indicators with pulsing animation */}
            {errorIndicators.map((error, index) => (
                <g key={`error-${index}`}>
                    {/* Pulsing outer ring */}
                    <circle
                        cx={error.x}
                        cy={error.y}
                        r={error.type === 'critical' ? 1.2 : error.type === 'warning' ? 0.9 : 0.6}
                        fill={error.color}
                        fillOpacity={0.3}
                        className="animate-ping"
                    />
                    {/* Main error dot */}
                    <circle
                        cx={error.x}
                        cy={error.y}
                        r={error.type === 'critical' ? 0.8 : error.type === 'warning' ? 0.6 : 0.4}
                        fill={error.color}
                        fillOpacity={0.8}
                    />
                </g>
            ))}
        </svg>
    )
}

const chartConfig = {
    errors: {
        label: 'Errors',
        color: '#ef4444',
    },
    sessions: {
        label: 'Sessions',
        color: '#10b981',
    },
    responseTime: {
        label: 'Response Time (ms)',
        color: '#3b82f6',
    },
    coreWebVitals: {
        label: 'Core Web Vitals',
        color: '#8b5cf6',
    },
    memoryUsage: {
        label: 'Memory Usage (MB)',
        color: '#f59e0b',
    },
    cpuUsage: {
        label: 'CPU Usage (%)',
        color: '#06b6d4',
    },
} satisfies ChartConfig

const chartData = [
    { month: 'Jan', errors: 5, sessions: 120, responseTime: 180, coreWebVitals: 25, memoryUsage: 45, cpuUsage: 15 },
    { month: 'Feb', errors: 15, sessions: 280, responseTime: 320, coreWebVitals: 45, memoryUsage: 85, cpuUsage: 35 },
    { month: 'Mar', errors: 35, sessions: 650, responseTime: 580, coreWebVitals: 75, memoryUsage: 180, cpuUsage: 65 },
    { month: 'Apr', errors: 25, sessions: 1200, responseTime: 720, coreWebVitals: 85, memoryUsage: 250, cpuUsage: 85 },
    { month: 'May', errors: 45, sessions: 1800, responseTime: 950, coreWebVitals: 92, memoryUsage: 380, cpuUsage: 95 },
    { month: 'Jun', errors: 60, sessions: 2800, responseTime: 1200, coreWebVitals: 98, memoryUsage: 520, cpuUsage: 98 },
]

const MonitoringChart = () => {
    return (
        <ChartContainer
            className="h-120 aspect-auto md:h-96"
            config={chartConfig}>
            <AreaChart
                accessibilityLayer
                data={chartData}
                margin={{
                    left: 0,
                    right: 0,
                }}>
                <defs>
                    <linearGradient
                        id="fillErrors"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1">
                        <stop
                            offset="0%"
                            stopColor="var(--color-errors)"
                            stopOpacity={0.9}
                        />
                        <stop
                            offset="35%"
                            stopColor="var(--color-errors)"
                            stopOpacity={0.4}
                        />
                        <stop
                            offset="100%"
                            stopColor="var(--color-errors)"
                            stopOpacity={0.05}
                        />
                    </linearGradient>
                    <linearGradient
                        id="fillSessions"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1">
                        <stop
                            offset="0%"
                            stopColor="var(--color-sessions)"
                            stopOpacity={0.85}
                        />
                        <stop
                            offset="30%"
                            stopColor="var(--color-sessions)"
                            stopOpacity={0.5}
                        />
                        <stop
                            offset="70%"
                            stopColor="var(--color-sessions)"
                            stopOpacity={0.2}
                        />
                        <stop
                            offset="100%"
                            stopColor="var(--color-sessions)"
                            stopOpacity={0.02}
                        />
                    </linearGradient>
                    <linearGradient
                        id="fillResponseTime"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1">
                        <stop
                            offset="0%"
                            stopColor="var(--color-responseTime)"
                            stopOpacity={0.6}
                        />
                        <stop
                            offset="55%"
                            stopColor="var(--color-responseTime)"
                            stopOpacity={0.1}
                        />
                    </linearGradient>
                    <linearGradient
                        id="fillCoreWebVitals"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1">
                        <stop
                            offset="0%"
                            stopColor="var(--color-coreWebVitals)"
                            stopOpacity={0.8}
                        />
                        <stop
                            offset="25%"
                            stopColor="var(--color-coreWebVitals)"
                            stopOpacity={0.6}
                        />
                        <stop
                            offset="65%"
                            stopColor="var(--color-coreWebVitals)"
                            stopOpacity={0.3}
                        />
                        <stop
                            offset="100%"
                            stopColor="var(--color-coreWebVitals)"
                            stopOpacity={0.05}
                        />
                    </linearGradient>
                    <linearGradient
                        id="fillMemoryUsage"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1">
                        <stop
                            offset="0%"
                            stopColor="var(--color-memoryUsage)"
                            stopOpacity={0.6}
                        />
                        <stop
                            offset="55%"
                            stopColor="var(--color-memoryUsage)"
                            stopOpacity={0.1}
                        />
                    </linearGradient>
                    <linearGradient
                        id="fillCpuUsage"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1">
                        <stop
                            offset="0%"
                            stopColor="var(--color-cpuUsage)"
                            stopOpacity={0.9}
                        />
                        <stop
                            offset="20%"
                            stopColor="var(--color-cpuUsage)"
                            stopOpacity={0.7}
                        />
                        <stop
                            offset="50%"
                            stopColor="var(--color-cpuUsage)"
                            stopOpacity={0.4}
                        />
                        <stop
                            offset="80%"
                            stopColor="var(--color-cpuUsage)"
                            stopOpacity={0.1}
                        />
                        <stop
                            offset="100%"
                            stopColor="var(--color-cpuUsage)"
                            stopOpacity={0.02}
                        />
                    </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <ChartTooltip
                    active
                    cursor={false}
                    content={<ChartTooltipContent className="dark:bg-muted" />}
                />
                <Area
                    strokeWidth={3}
                    dataKey="sessions"
                    type="stepAfter"
                    fill="url(#fillSessions)"
                    fillOpacity={0.3}
                    stroke="var(--color-sessions)"
                    strokeDasharray="0"
                    className="animate-pulse"
                />
                <Area
                    strokeWidth={2.5}
                    dataKey="errors"
                    type="basisOpen"
                    fill="url(#fillErrors)"
                    fillOpacity={0.25}
                    stroke="var(--color-errors)"
                    strokeDasharray="8,4"
                />
                <Area
                    strokeWidth={3.5}
                    dataKey="responseTime"
                    type="monotone"
                    fill="url(#fillResponseTime)"
                    fillOpacity={0.2}
                    stroke="var(--color-responseTime)"
                    strokeDasharray="0"
                    className="drop-shadow-lg"
                />
                <Area
                    strokeWidth={2.8}
                    dataKey="coreWebVitals"
                    type="monotone"
                    fill="url(#fillCoreWebVitals)"
                    fillOpacity={0.3}
                    stroke="var(--color-coreWebVitals)"
                    strokeDasharray="12,6"
                    className="animate-pulse"
                />
                <Area
                    strokeWidth={2.2}
                    dataKey="memoryUsage"
                    type="stepBefore"
                    fill="url(#fillMemoryUsage)"
                    fillOpacity={0.25}
                    stroke="var(--color-memoryUsage)"
                    strokeDasharray="6,3,2,3"
                />
                <Area
                    strokeWidth={3.2}
                    dataKey="cpuUsage"
                    type="basis"
                    fill="url(#fillCpuUsage)"
                    fillOpacity={0.35}
                    stroke="var(--color-cpuUsage)"
                    strokeDasharray="15,8"
                    className="animate-pulse drop-shadow-lg"
                />
            </AreaChart>
        </ChartContainer>
    )
}