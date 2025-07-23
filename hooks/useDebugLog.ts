


import { useState, useCallback } from 'react';

export const useDebugLog = (storageKey: string) => {
    const [logs, setLogs] = useState<string[]>([]);
    
    const addLog = useCallback((message: string) => {
        const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
        const finalMessage = `[${timestamp}] ${message}`;
        console.log(finalMessage);
        setLogs(prev => [finalMessage, ...prev].slice(0, 100));
    }, []);

    const handleResetProgress = useCallback(() => {
        if (window.confirm("Are you sure you want to reset all progress? This will clear your workspace and chat history.")) {
            localStorage.removeItem(storageKey);
            sessionStorage.removeItem('google-api-key');
            addLog("Application state has been reset.");
            window.location.reload();
        }
    }, [addLog, storageKey]);

    return { logs, addLog, handleResetProgress };
};