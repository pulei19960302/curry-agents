import { useEffect } from "react";

import useAgentCoreStore from "../stores/agent-core-store";

export default function useAgentCore() {
  const store = useAgentCoreStore();

  useEffect(() => {
    store.loadTools();
  }, []);

  return store;
}
