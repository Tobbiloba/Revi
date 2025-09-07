import React from 'react';
import { cn } from '@/lib/utils';

interface Props {
    className?: string;
    children: React.ReactNode;
}

const Wrapper = ({ className, children }: Props) => {
    return (
        <section className={cn(
            "h-full mx-auto w-full lg:max-w-8xl px-4 lg:px-4",
            className,
        )}>
            {children}
        </section>
    )
};

export default Wrapper
