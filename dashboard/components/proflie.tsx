"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Settings, CreditCard, LogOut, User, FolderOpen, Loader2, Shield, Calendar } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserInfo {
    id: string;
    name: string;
    image?: string | null | undefined;
    email: string;
    emailVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
}

interface Profile {
    name: string;
    email: string;
    avatar: string;
    subscription?: string;
    model?: string;
    emailVerified?: boolean;
    memberSince?: string;
    projectsCount?: number;
}

interface MenuItem {
    label: string;
    value?: string;
    href: string;
    icon: React.ReactNode;
    external?: boolean;
}

// Default fallback data
const FALLBACK_PROFILE_DATA: Profile = {
    name: "Loading...",
    email: "Loading...",
    avatar: "/logo-white.png",
    subscription: "Free",
    model: "Standard",
};

interface ProfileDropdownProps extends React.HTMLAttributes<HTMLDivElement> {
    showTopbar?: boolean;
}

export default function ProfileDropdown({
    className,
    ...props
}: ProfileDropdownProps) {
    const [isOpen, setIsOpen] = React.useState(false);
    const [userInfo, setUserInfo] = React.useState<UserInfo | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [projectsCount, setProjectsCount] = React.useState(0);
    const router = useRouter();

    // Fetch user data
    const fetchUserData = React.useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const result = await authClient.getSession();

            if (!result.data?.user) {
                setError("Unable to load user data");
                return;
            }

            setUserInfo(result.data?.user);
            // TODO: Fetch projects count from API
            setProjectsCount(3); // Placeholder
        } catch (error) {
            console.error("Error fetching user data:", error);
            setError("Failed to load user profile");
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        fetchUserData();
    }, [fetchUserData]);

    // Handle sign out
    const handleSignOut = async () => {
        await authClient.signOut({
            fetchOptions: {
                onSuccess: () => {
                    router.push("/sign-in");
                },
            },
        });
    };

    // Prepare profile data
    const data: Profile = React.useMemo(() => {
        if (loading || !userInfo) {
            return FALLBACK_PROFILE_DATA;
        }

        return {
            name: userInfo.name,
            email: userInfo.email,
            avatar: userInfo.image || "/logo-white.png",
            subscription: "Free", // TODO: Get from subscription data
            model: "Error Monitor",
            emailVerified: userInfo.emailVerified,
            memberSince: new Date(userInfo.createdAt).toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric'
            }),
            projectsCount
        };
    }, [userInfo, loading, projectsCount]);
    const menuItems: MenuItem[] = [
        {
            label: "Profile",
            href: "/dashboard/settings?tab=profile",
            icon: <User className="w-4 h-4" />,
        },
        {
            label: "Projects",
            value: data.projectsCount ? `${data.projectsCount} active` : undefined,
            href: "/dashboard/projects",
            icon: <FolderOpen className="w-4 h-4" />,
        },
        {
            label: "Account Status",
            value: data.emailVerified ? "Verified" : "Unverified",
            href: "/dashboard/settings?tab=profile",
            icon: <Shield className="w-4 h-4" />,
        },
        {
            label: "Member Since",
            value: data.memberSince,
            href: "/dashboard/settings?tab=profile",
            icon: <Calendar className="w-4 h-4" />,
        },
        {
            label: "Plan",
            value: data.subscription,
            href: "/dashboard/settings?tab=billing",
            icon: <CreditCard className="w-4 h-4" />,
        },
        {
            label: "Settings",
            href: "/dashboard/settings",
            icon: <Settings className="w-4 h-4" />,
        },
    ];

    return (
        <div className={cn("relative", className)} {...props}>
            <DropdownMenu onOpenChange={setIsOpen}>
                <div className="group relative">
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            className="flex items-center gap-16 p-3 py-2 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 hover:shadow-sm transition-all duration-200 focus:outline-none"
                        >
                            <div className="text-left flex-1">
                                <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100 tracking-tight leading-tight flex items-center gap-2">
                                    {loading ? (
                                        <>
                                            <span>Loading...</span>
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                        </>
                                    ) : error ? (
                                        <span className="text-red-500">Error loading profile</span>
                                    ) : (
                                        data.name
                                    )}
                                </div>
                                <div className="text-xs text-zinc-500 dark:text-zinc-400 tracking-tight leading-tight">
                                    {loading ? "Loading..." : error ? "Please refresh" : data.email}
                                </div>
                            </div>
                            <div className="relative">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 p-0.5">
                                    <div className="w-full h-full rounded-full overflow-hidden bg-white dark:bg-zinc-900">
                                        {loading ? (
                                            <div className="flex items-center justify-center w-full h-full">
                                                <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
                                            </div>
                                        ) : (
                                            <Image
                                                src={data.avatar}
                                                alt={data.name}
                                                width={36}
                                                height={36}
                                                className="w-full h-full object-cover rounded-full"
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>
                        </button>
                    </DropdownMenuTrigger>

                    {/* Bending line indicator on the right */}
                    <div
                        className={cn(
                            "absolute -right-3 top-1/2 -translate-y-1/2 transition-all duration-200",
                            isOpen
                                ? "opacity-100"
                                : "opacity-60 group-hover:opacity-100"
                        )}
                    >
                        <svg
                            width="12"
                            height="24"
                            viewBox="0 0 12 24"
                            fill="none"
                            className={cn(
                                "transition-all duration-200",
                                isOpen
                                    ? "text-blue-500 dark:text-blue-400 scale-110"
                                    : "text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300"
                            )}
                            aria-hidden="true"
                        >
                            <path
                                d="M2 4C6 8 6 16 2 20"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                fill="none"
                            />
                        </svg>
                    </div>

                    <DropdownMenuContent
                        align="end"
                        sideOffset={4}
                        className="w-64 p-2 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm border border-zinc-200/60 dark:border-zinc-800/60 rounded-2xl shadow-xl shadow-zinc-900/5 dark:shadow-zinc-950/20 
                    data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-top-right"
                    >
                        <div className="space-y-1">
                            {menuItems.map((item) => (
                                <DropdownMenuItem key={item.label} asChild>
                                    <Link
                                        href={item.href}
                                        className="flex items-center p-3 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/60 rounded-xl transition-all duration-200 cursor-pointer group hover:shadow-sm border border-transparent hover:border-zinc-200/50 dark:hover:border-zinc-700/50"
                                    >
                                        <div className="flex items-center gap-2 flex-1">
                                            {item.icon}
                                            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 tracking-tight leading-tight whitespace-nowrap group-hover:text-zinc-950 dark:group-hover:text-zinc-50 transition-colors">
                                                {item.label}
                                            </span>
                                        </div>
                                        <div className="flex-shrink-0 ml-auto">
                                            {item.value && (
                                                <span
                                                    className={cn(
                                                        "text-xs font-medium rounded-md py-1 px-2 tracking-tight",
                                                        item.label === "Account Status" && data.emailVerified
                                                            ? "text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-500/10 border border-green-500/10"
                                                            : item.label === "Account Status" && !data.emailVerified
                                                            ? "text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-500/10 border border-orange-500/10"
                                                            : item.label === "Plan"
                                                            ? "text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-500/10 border border-purple-500/10"
                                                            : item.label === "Projects"
                                                            ? "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-500/10 border border-blue-500/10"
                                                            : "text-zinc-600 bg-zinc-50 dark:text-zinc-400 dark:bg-zinc-500/10 border border-zinc-500/10"
                                                    )}
                                                >
                                                    {item.value}
                                                </span>
                                            )}
                                        </div>
                                    </Link>
                                </DropdownMenuItem>
                            ))}
                        </div>

                        <DropdownMenuSeparator className="my-3 bg-gradient-to-r from-transparent via-zinc-200 to-transparent dark:via-zinc-800" />

                        <DropdownMenuItem asChild>
                            <button
                                type="button"
                                onClick={handleSignOut}
                                disabled={loading}
                                className="w-full flex items-center gap-3 p-3 duration-200 bg-red-500/10 rounded-xl hover:bg-red-500/20 cursor-pointer border border-transparent hover:border-red-500/30 hover:shadow-sm transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <LogOut className="w-4 h-4 text-red-500 group-hover:text-red-600" />
                                <span className="text-sm font-medium text-red-500 group-hover:text-red-600">
                                    Sign Out
                                </span>
                            </button>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </div>
            </DropdownMenu>
        </div>
    );
}
