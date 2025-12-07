import React from 'react';
import { AmazonSkeleton } from './AmazonSkeleton';

interface AmazonSpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export const AmazonSpinner: React.FC<AmazonSpinnerProps> = ({
    size = 'md',
    className = ''
}) => {
    const sizeClasses = {
        sm: 'w-6 h-6 border-2',
        md: 'w-10 h-10 border-4',
        lg: 'w-16 h-16 border-4',
    };

    return (
        <div className={`flex justify-center items-center ${className}`}>
            <div
                className={`${sizeClasses[size]} border-gray-200 border-t-[#232f3e] rounded-full animate-spin`}
                role="status"
                aria-label="loading"
            />
        </div>
    );
};
