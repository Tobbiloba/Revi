import { AlertTriangle, Eye, Shield, Zap } from 'lucide-react'
import Image from 'next/image'
export default function ContentSection() {
    return (
        <section className="py-16 md:py-32">  
            <div className=" space-y-12 px-6">
                <div className="mx-auto max-w-7xl relative z-10 grid items-center gap-4 md:grid-cols-2 md:gap-12">
                    <h2 className="text-4xl font-semibold">Complete error monitoring and session replay</h2>
                    <p className="max-w-sm sm:ml-auto edu text-md">Catch frontend errors before your users do. See exactly what happened with complete session replays and real-time error tracking.</p>
                </div>
                {/* Bento Grid Layout */}
                <div className="relative mx-auto max-w-8xl">
                    <div className="grid grid-cols-12 grid-rows-6 gap-4 h-[600px] md:h-[800px]">
                        {/* Main Dashboard Preview - Large Feature */}
                        <div className="relative col-span-12 md:col-span-8 row-span-5 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 border border-white/10 shadow-2xl group">
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-10"></div>
                            <div className="absolute top-4 left-4 z-20 flex items-center gap-3">
                                {/* <div className="flex items-center gap-1.5">
                                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                </div> */}
                                <span className="text-white/80 text-sm font-medium">Dashboard Overview</span>
                            </div>
                            <Image
                                src="/img.png"
                                className="absolute inset-0 z-0 object-cover group-hover:scale-105 transition-transform duration-700"
                                alt="Main dashboard interface"
                                fill
                                sizes="(max-width: 768px) 100vw, 70vw"
                            />
                            <div className="absolute bottom-4 left-4 z-20 text-white">
                                <h3 className="text-xl font-semibold mb-1">Real-time Monitoring</h3>
                                <p className="text-white/80 text-sm">Complete error tracking and session replay dashboard</p>
                            </div>
                        </div>

                        {/* Error Analytics - Medium */}
                        <div className="relative col-span-12 md:col-span-4 row-span-3 overflow-hidden rounded-2xl bg-gradient-to-br from-red-900/30 to-slate-900/30 border border-white/20 group">
                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent z-10"></div>
                            <Image
                                src="/img3.png"
                                className="absolute inset-0 z-0 object-cover group-hover:scale-105 transition-transform duration-700"
                                alt="Error analytics interface"
                                fill
                                sizes="(max-width: 768px) 100vw, 30vw"
                            />
                            <div className="absolute top-4 left-4 z-20">
                                <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse"></div>
                            </div>
                            <div className="absolute bottom-4 left-4 z-20 text-white">
                                <h3 className="text-sm font-semibold">Session Replay</h3>
                                <p className="text-white/80 text-xs">Watch user interactions</p>
                            </div>
                        </div>

                        {/* Session Replay - Medium */}
                        <div className="relative col-span-6 md:col-span-4 row-span-2 overflow-hidden rounded-2xl bg-gradient-to-br from-blue-900/30 to-purple-900/30 border border-gray-500/20 group">
                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent z-10"></div>
                            <Image
                                src="/img2.png"
                                className="absolute inset-0 z-0 object-cover group-hover:scale-105 transition-transform duration-700"
                                alt="Session replay interface"
                                fill
                                sizes="(max-width: 768px) 50vw, 25vw"
                            />
                            <div className="absolute top-3 left-3 z-20">
                                <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                            </div>
                            <div className="absolute bottom-3 left-3 z-20 text-white">
                                                                <h3 className="text-lg font-semibold mb-1">Error Analytics</h3>
                                <p className="text-white/80 text-xs">Track and analyze errors in real-time</p>


                            </div>
                        </div>

                    </div>
                </div>
                <div className="relative mx-auto max-w-7xl grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-8 lg:grid-cols-4">
                    <div className="space-y-3 bg-background/20 text-foreground cursor-pointer rounded-full px-3 py-1 text-sm font-semibold bg-blend-luminosity backdrop-blur-xl">
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="size-5" strokeWidth={1}/>
                            <h3 className="text-base font-[400]">Error Tracking</h3>
                        </div>
                        <p className="text-muted-foreground text-base leading-relaxed font-[300]">Capture and monitor frontend errors in real-time with detailed stack traces and context.</p>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <Eye className="size-5" strokeWidth={1}/>
                            <h3 className="text-base font-[400]">Session Replay</h3>
                        </div>
                        <p className="text-muted-foreground text-base leading-relaxed font-[300]">Watch exactly what users experienced when errors occurred with complete session playback.</p>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <Shield className="size-5" strokeWidth={1}/>
                            <h3 className="text-base font-[400]">Privacy First</h3>
                        </div>
                        <p className="text-muted-foreground text-base leading-relaxed font-[300]">Built with privacy in mind, mask sensitive data and maintain GDPR compliance.</p>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <Zap className="size-5" strokeWidth={1}/>
                            <h3 className="text-base font-[400]">Fast Setup</h3>
                        </div>
                        <p className="text-muted-foreground text-base leading-relaxed font-[300]">Get started in minutes with our lightweight SDK and intuitive dashboard interface.</p>
                    </div>
                </div>
            </div>
        </section>
    )
}