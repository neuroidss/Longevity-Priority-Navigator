
import { useState, useEffect } from 'react';
import { type ModelDefinition } from '../types';
import { SUPPORTED_MODELS } from '../constants';

export const useAppSettings = (addLog: (msg: string) => void, storageKey: string) => {
  const [model, setModel] = useState<ModelDefinition>(SUPPORTED_MODELS[0]);
  const [apiKey, setApiKey] = useState<string>('');

  useEffect(() => {
    const savedKey = sessionStorage.getItem('google-api-key');
    if (savedKey) {
        setApiKey(savedKey);
        addLog("Loaded Google AI API Key from session storage.");
    }
    
    try {
        const savedStateJSON = localStorage.getItem(storageKey);
        if (savedStateJSON) {
            const savedState = JSON.parse(savedStateJSON);
            const savedModel = SUPPORTED_MODELS.find(m => m.id === savedState.model?.id) || SUPPORTED_MODELS[0];
            setModel(savedModel);
        }
    } catch (error) {
        addLog(`Failed to load settings from localStorage: ${error}. Using defaults.`);
    }
  }, [addLog, storageKey]);

  const handleApiKeyChange = (key: string) => {
      setApiKey(key);
      sessionStorage.setItem('google-api-key', key);
      addLog("Google AI API Key has been updated for this session.");
  };

  return {
    model,
    setModel,
    apiKey,
    setApiKey: handleApiKeyChange,
  };
};