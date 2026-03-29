import React, { createContext, useContext, useState, useEffect } from 'react';

export type AccessibilityProfile = 'none' | 'neurodiverse' | 'mobility' | 'silent' | 'visual';

interface AccessibilitySettings {
  profile: AccessibilityProfile;
  accommodations: {
    ignoreGazeViolations: boolean;
    ignoreSpeechViolations: boolean;
    ignoreMovementViolations: boolean;
    enableHeadTiltNavigation: boolean;
    aiCoachSimplification: boolean;
    highContrastUI: boolean;
  };
}

interface AccessibilityContextType {
  settings: AccessibilitySettings;
  setProfile: (profile: AccessibilityProfile) => void;
  updateAccommodations: (updates: Partial<AccessibilitySettings['accommodations']>) => void;
}

const defaultSettings: AccessibilitySettings = {
  profile: 'none',
  accommodations: {
    ignoreGazeViolations: false,
    ignoreSpeechViolations: false,
    ignoreMovementViolations: false,
    enableHeadTiltNavigation: false,
    aiCoachSimplification: false,
    highContrastUI: false,
  },
};

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AccessibilitySettings>(() => {
    const saved = localStorage.getItem('yoscore_accessibility_settings');
    return saved ? JSON.parse(saved) : defaultSettings;
  });

  useEffect(() => {
    localStorage.setItem('yoscore_accessibility_settings', JSON.stringify(settings));
    
    // Apply high contrast class to body if enabled
    if (settings.accommodations.highContrastUI) {
      document.body.classList.add('high-contrast');
    } else {
      document.body.classList.remove('high-contrast');
    }
  }, [settings]);

  const setProfile = (profile: AccessibilityProfile) => {
    let accommodations = { ...defaultSettings.accommodations };

    switch (profile) {
      case 'neurodiverse':
        accommodations = {
          ...accommodations,
          ignoreGazeViolations: true,
          aiCoachSimplification: true,
        };
        break;
      case 'mobility':
        accommodations = {
          ...accommodations,
          ignoreMovementViolations: true,
          enableHeadTiltNavigation: true,
        };
        break;
      case 'silent':
        accommodations = {
          ...accommodations,
          ignoreSpeechViolations: true,
        };
        break;
      case 'visual':
        accommodations = {
          ...accommodations,
          ignoreGazeViolations: true,
          ignoreMovementViolations: true,
          highContrastUI: true,
        };
        break;
    }

    setSettings({ profile, accommodations });
  };

  const updateAccommodations = (updates: Partial<AccessibilitySettings['accommodations']>) => {
    setSettings(prev => ({
      ...prev,
      accommodations: { ...prev.accommodations, ...updates }
    }));
  };

  return (
    <AccessibilityContext.Provider value={{ settings, setProfile, updateAccommodations }}>
      {children}
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (context === undefined) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
};
