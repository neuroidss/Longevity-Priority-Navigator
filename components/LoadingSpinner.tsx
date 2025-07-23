
import React from 'react';

interface LoadingSpinnerProps {
    message?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message = "Analyzing Information..." }) => {
  return (
    <div className="flex flex-col items-center justify-center space-y-4 py-12">
      <div className="w-24 h-24 border-8 border-dashed rounded-full animate-spin border-blue-500"></div>
      <p className="text-lg text-slate-300 font-semibold tracking-wider text-center px-4">{message}</p>
    </div>
  );
};

export default LoadingSpinner;