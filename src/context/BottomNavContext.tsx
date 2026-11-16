import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

const SCROLL_THRESHOLD = 8;

type BottomNavContextValue = {
  isBottomNavCompact: boolean;
  setBottomNavCompact: (compact: boolean) => void;
};

const BottomNavContext = createContext<BottomNavContextValue | undefined>(undefined);

type BottomNavProviderProps = {
  children: ReactNode;
};

export function BottomNavProvider({ children }: BottomNavProviderProps) {
  const [isBottomNavCompact, setCompact] = useState(false);

  const setBottomNavCompact = useCallback((compact: boolean) => {
    setCompact((current) => (current === compact ? current : compact));
  }, []);

  const value = useMemo(
    () => ({
      isBottomNavCompact,
      setBottomNavCompact,
    }),
    [isBottomNavCompact, setBottomNavCompact],
  );

  return <BottomNavContext.Provider value={value}>{children}</BottomNavContext.Provider>;
}

export function useBottomNav() {
  const context = useContext(BottomNavContext);

  if (!context) {
    throw new Error('useBottomNav must be used within BottomNavProvider');
  }

  return context;
}

export function useBottomNavScrollHandler() {
  const context = useContext(BottomNavContext);
  const previousYRef = useRef(0);

  useEffect(() => {
    if (context) {
      previousYRef.current = 0;
      context.setBottomNavCompact(false);
      return () => context.setBottomNavCompact(false);
    }
  }, [context]);

  return useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!context) return;
      const currentY = Math.max(0, event.nativeEvent.contentOffset.y);
      const previousY = previousYRef.current;

      if (currentY <= SCROLL_THRESHOLD) {
        previousYRef.current = currentY;
        context.setBottomNavCompact(false);
        return;
      }

      if (currentY > previousY + SCROLL_THRESHOLD) {
        previousYRef.current = currentY;
        context.setBottomNavCompact(true);
        return;
      }

      if (currentY < previousY - SCROLL_THRESHOLD) {
        previousYRef.current = currentY;
        context.setBottomNavCompact(false);
      }
    },
    [context],
  );
}
