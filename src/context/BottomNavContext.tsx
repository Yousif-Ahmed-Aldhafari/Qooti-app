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
  const { setBottomNavCompact } = useBottomNav();
  const previousYRef = useRef(0);

  useEffect(() => {
    previousYRef.current = 0;
    setBottomNavCompact(false);

    return () => setBottomNavCompact(false);
  }, [setBottomNavCompact]);

  return useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const currentY = Math.max(0, event.nativeEvent.contentOffset.y);
      const previousY = previousYRef.current;

      if (currentY <= SCROLL_THRESHOLD) {
        previousYRef.current = currentY;
        setBottomNavCompact(false);
        return;
      }

      if (currentY > previousY + SCROLL_THRESHOLD) {
        previousYRef.current = currentY;
        setBottomNavCompact(true);
        return;
      }

      if (currentY < previousY - SCROLL_THRESHOLD) {
        previousYRef.current = currentY;
        setBottomNavCompact(false);
      }
    },
    [setBottomNavCompact],
  );
}
