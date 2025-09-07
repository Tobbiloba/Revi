"use client";
import {
    Navbar,
    NavBody,
    NavItems,
    MobileNav,
    NavbarLogo,
    MobileNavHeader,
    MobileNavToggle,
    MobileNavMenu,
} from "@/components/ui/resizable-navbar";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

// Custom NavBody wrapper that passes visible state to children
const CustomNavBody = ({ className, visible, navItems }: { className?: string, visible?: boolean, navItems: Array<{name: string, link: string}> }) => {
    return (
        <NavBody className={className} visible={visible}>
            <NavbarLogo />
            <NavItems items={navItems} />
            <div className="flex items-center gap-4">
                <AuthSection visible={visible} />
            </div>
        </NavBody>
    );
};

// Mobile auth section component
const MobileAuthSection = ({ onClose }: { onClose: () => void }) => {
    const { data: session, isPending } = authClient.useSession();

    if (isPending) {
        return <div className="text-sm text-neutral-600 dark:text-neutral-300">Loading...</div>;
    }

    if (session?.user) {
        return (
            <div className="flex flex-col gap-3">
                <span className="text-sm font-normal text-neutral-600 dark:text-neutral-300">
                    Hello, {session.user.name || session.user.email}
                </span>
                <a 
                    href="/dashboard"
                    onClick={onClose} 
                    className="text-sm font-normal text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
                >
                    Dashboard
                </a>
            </div>
        );
    }

    return (
        <a 
            href="/sign-in"
            onClick={onClose} 
            className="text-sm font-normal text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
        >
            Sign In
        </a>
    );
};

// Auth section component that adapts to navbar visibility
const AuthSection = ({ visible }: { visible?: boolean }) => {
    const { data: session, isPending } = authClient.useSession();
    
    const textColorClass = visible 
        ? "text-neutral-800 dark:text-neutral-900" 
        : "text-neutral-600 dark:text-neutral-300";
    
    const hoverColorClass = visible 
        ? "hover:text-neutral-900 dark:hover:text-black" 
        : "hover:text-neutral-900 dark:hover:text-neutral-100";

    if (isPending) {
        return <div className={`text-sm ${textColorClass}`}>Loading...</div>;
    }

    if (session?.user) {
        return (
            <div className="flex items-center gap-3 relative z-10">
                <span className={`text-sm font-normal ${textColorClass}`}>
                    Hello, {session.user.name || session.user.email}
                </span>
                <a 
                    href="/dashboard" 
                    className={`text-sm font-normal ${textColorClass} ${hoverColorClass} transition-colors`}
                >
                    Dashboard
                </a>
            </div>
        );
    }

    return (
        <a 
            href="/sign-in" 
            className={`text-sm font-normal relative z-10 ${textColorClass} ${hoverColorClass} transition-colors`}
        >
            Sign In
        </a>
    );
};

export function Menubar() {
    const navItems = [
        { name: "Features", link: "#features" },
        { name: "Documentation", link: "/docs/getting-started/introduction" },
        { name: "Pricing", link: "#" },
        { name: "Dashboard", link: "/dashboard" }
    ];

    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    return (
        <div className="z-10 w-full fixed top-0">
            <Navbar>
                {/* Desktop Navigation */}
                <CustomNavBody navItems={navItems} />

                {/* Mobile Navigation */}
                <MobileNav>
                    <MobileNavHeader>
                        <NavbarLogo />
                        <MobileNavToggle
                            isOpen={isMobileMenuOpen}
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        />
                    </MobileNavHeader>

                    <MobileNavMenu
                        isOpen={isMobileMenuOpen}
                        onClose={() => setIsMobileMenuOpen(false)}
                    >
                        {navItems.map((item, idx) => (
                            <a
                                key={`mobile-link-${idx}`}
                                href={item.link}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="relative text-neutral-600 dark:text-neutral-300"
                            >
                                <span className="block">{item.name}</span>
                            </a>
                        ))}
                        <div className="flex w-full flex-col gap-4">
                            <MobileAuthSection onClose={() => setIsMobileMenuOpen(false)} />
                        </div>
                    </MobileNavMenu>
                </MobileNav>
            </Navbar>
            {/* Navbar */}
        </div>
    );
}
