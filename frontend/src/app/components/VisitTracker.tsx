import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { selectedHttpClient } from "@/shared/api/http/selectedHttpClient";

export const VisitTracker = () => {
  const location = useLocation();
  useEffect(() => {
    void selectedHttpClient.post(`/visits?path=${encodeURIComponent(location.pathname)}`).catch(() => undefined);
  }, [location.pathname]);
  return null;
};
