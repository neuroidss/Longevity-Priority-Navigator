
import { useState, useEffect, useCallback } from 'react';

const API_USAGE_STORAGE_KEY = 'apiUsageState';
const DEFAULT_API_LIMIT = 50;

interface ApiUsageState {
    count: number;
    limit: number;
    date: string; // YYYY-MM-DD
}

const getTodayDateString = () => new Date().toISOString().split('T')[0];

export const useApiUsageManager = (addLog: (msg: string) => void) => {
    const [usageState, setUsageState] = useState<ApiUsageState>({
        count: 0,
        limit: DEFAULT_API_LIMIT,
        date: getTodayDateString(),
    });

    useEffect(() => {
        try {
            const savedStateJSON = localStorage.getItem(API_USAGE_STORAGE_KEY);
            const today = getTodayDateString();

            if (savedStateJSON) {
                const savedState: ApiUsageState = JSON.parse(savedStateJSON);
                
                if (savedState.date === today) {
                    setUsageState(savedState);
                    addLog(`Loaded API usage for today: ${savedState.count}/${savedState.limit} calls.`);
                } else {
                    // It's a new day, reset count but keep the limit
                    const newState = { ...savedState, count: 0, date: today };
                    setUsageState(newState);
                    localStorage.setItem(API_USAGE_STORAGE_KEY, JSON.stringify(newState));
                    addLog(`New day detected. API call count reset. Limit is ${newState.limit}.`);
                }
            } else {
                // No saved state, initialize
                const initialState = { count: 0, limit: DEFAULT_API_LIMIT, date: today };
                setUsageState(initialState);
                localStorage.setItem(API_USAGE_STORAGE_KEY, JSON.stringify(initialState));
                 addLog(`Initialized API usage tracker with a default limit of ${DEFAULT_API_LIMIT}.`);
            }
        } catch (error) {
            addLog(`ERROR: Could not load API usage state. Using defaults. ${error}`);
        }
    }, [addLog]);

    const setApiCallLimit = useCallback((newLimit: number) => {
        setUsageState(prevState => {
            const newState = { ...prevState, limit: newLimit };
            localStorage.setItem(API_USAGE_STORAGE_KEY, JSON.stringify(newState));
            addLog(`API call limit updated to ${newLimit}.`);
            return newState;
        });
    }, []);
    
    const checkAndIncrement = useCallback(async () => {
        // We read from localStorage directly to ensure consistency across tabs/windows
        const savedStateJSON = localStorage.getItem(API_USAGE_STORAGE_KEY);
        const today = getTodayDateString();
        
        let currentState: ApiUsageState = { count: 0, limit: DEFAULT_API_LIMIT, date: today };
        if (savedStateJSON) {
            currentState = JSON.parse(savedStateJSON);
        }

        // Double check for date change
        if (currentState.date !== today) {
            currentState = { ...currentState, count: 0, date: today };
        }

        if (currentState.count >= currentState.limit) {
            const errorMsg = `Daily API call limit of ${currentState.limit} has been reached. You can change the limit in Advanced Settings.`;
            addLog(`ERROR: ${errorMsg}`);
            throw new Error(errorMsg);
        }
        
        const newState = { ...currentState, count: currentState.count + 1 };
        setUsageState(newState);
        localStorage.setItem(API_USAGE_STORAGE_KEY, JSON.stringify(newState));
        addLog(`API call ${newState.count}/${newState.limit} recorded.`);

    }, [addLog]);


    return {
        usageState,
        setApiCallLimit,
        checkAndIncrement,
        isLimitReached: usageState.count >= usageState.limit,
    };
};
