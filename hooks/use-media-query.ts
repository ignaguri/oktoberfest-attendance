import { useSyncExternalStore } from "react";

function useMediaQuery(query: string): boolean {
  const subscribe = (callback: () => void) => {
    if (typeof window === "undefined") {
      return () => {};
    }
    const mediaQueryList = window.matchMedia(query);
    mediaQueryList.addEventListener("change", callback);
    return () => {
      mediaQueryList.removeEventListener("change", callback);
    };
  };

  const getSnapshot = () => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.matchMedia(query).matches;
  };

  const getServerSnapshot = () => {
    return false;
  };

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export default useMediaQuery;
