import { useSyncExternalStore } from "react";

function useMediaQuery(query: string): boolean {
  const subscribe = (callback: () => void) => {
    const mediaQueryList = window.matchMedia(query);
    mediaQueryList.addEventListener("change", callback);
    return () => {
      mediaQueryList.removeEventListener("change", callback);
    };
  };

  const getSnapshot = () => {
    return window.matchMedia(query).matches;
  };

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export default useMediaQuery;
