import React, { useState } from 'react';

interface DebugLogViewProps {
    logs: string[];
    onReset: () => void;
}

const DebugLogView: React.FC<DebugLogViewProps> = ({ logs, onReset }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="fixed bottom-4 right-4 z-[100]">
            <div className={`absolute bottom-full right-0 mb-2 w-96 max-w-[calc(100vw-2rem)] h-96 bg-slate-900/90 backdrop-blur-sm border border-slate-600 rounded-lg p-2 flex-col ${isOpen ? 'flex' : 'hidden'}`}>
                <div className="flex justify-between items-center mb-2 gap-2">
                    <h3 className="text-lg font-bold text-slate-200">Event Log</h3>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onReset}
                            className="text-xs px-2 py-1 bg-red-800/50 text-red-300 border border-red-700 rounded-md hover:bg-red-700/50"
                            title="Reset all progress and saved data"
                        >
                            Reset Progress
                        </button>
                         <button
                            onClick={() => setIsOpen(false)}
                            className="text-slate-400 hover:text-white"
                            aria-label="Close log"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>
                <div className="flex-grow overflow-y-auto bg-black/30 p-2 rounded text-xs font-mono">
                    {logs.map((log, index) => {
                        const logUpper = log.toUpperCase();
                        let colorClass = 'text-slate-300';
                        if (logUpper.includes('ERROR')) {
                            colorClass = 'text-red-400';
                        } else if (logUpper.includes('WARN')) {
                            colorClass = 'text-yellow-400';
                        }
                        
                        return (
                            <p key={index} className={`py-0.5 border-b border-slate-800 break-words ${colorClass}`}>
                                {log}
                            </p>
                        );
                    })}
                </div>
            </div>
             <button
                onClick={() => setIsOpen(!isOpen)}
                className="bg-slate-700 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-slate-600 flex items-center gap-2"
                aria-label="Toggle debug log"
            >
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 102 0V6zM10 15a1 1 0 110-2 1 1 0 010 2z" clipRule="evenodd" />
                </svg>
                Debug Log ({logs.length})
            </button>
        </div>
    );
};

export default DebugLogView;