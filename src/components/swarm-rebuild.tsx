import { useEffect, useRef } from "react";
import { useLocation } from "@tanstack/react-router";
import { SwarmRebuild, type SwarmConfig } from "@/lib/swarm/swarm-rebuild";

/** Global runner: plays on each page mount (including refresh) and path change in auto mode. */
export function SwarmRebuildRunner(props: { config?: Partial<SwarmConfig> }) {
  const path = useLocation({ select: (l) => l.pathname });
  const cfgRef = useRef(props.config);
  useEffect(() => {
    window.SwarmRebuild = SwarmRebuild;
    if (cfgRef.current) SwarmRebuild.configure(cfgRef.current);
    return () => SwarmRebuild.stop();
  }, []);
  useEffect(() => {
    if (cfgRef.current?.auto === false) return;
    SwarmRebuild.stop();
    const id = window.setTimeout(() => SwarmRebuild.start(), 400);
    return () => { clearTimeout(id); SwarmRebuild.stop(); };
  }, [path]);
  return null;
}
