import React from 'react';

interface AmazonSkeletonProps {
    className?: string;
    width?: string | number;
    height?: string | number;
}

export const AmazonSkeleton: React.FC<AmazonSkeletonProps> = ({
    className = '',
    width,
    height
}) => {
    const style = {
        width,
        height,
    };

    return (
        <div
            className={`relative overflow-hidden rounded ${className} after:absolute after:inset-0 after:-translate-x-full after:animate-[shimmer_1.5s_infinite] after:bg-gradient-to-r after:from-transparent after:via-white/50 after:to-transparent`}
            style={style}
        />
    );
};
