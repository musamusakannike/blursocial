import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, ThemeColors, ColorScheme } from '@/constants/colors';

interface ThemeContextType {
  scheme: ColorScheme;
  colors: ThemeColors;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  scheme: 'dark',
  colors: Colors.dark,
  toggleTheme: () => {},
  isDark: true,
});

const THEME_KEY = 'blur_theme_preference';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [scheme, setScheme] = useState<ColorScheme>(systemScheme === 'light' ? 'light' : 'dark');

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((stored) => {
      if (stored === 'dark' || stored === 'light') {
        setScheme(stored);
      }
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setScheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      AsyncStorage.setItem(THEME_KEY, next);
      return next;
    });
  }, []);

  const colors = Colors[scheme];
  const isDark = scheme === 'dark';

  return (
    <ThemeContext.Provider value={{ scheme, colors, toggleTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
