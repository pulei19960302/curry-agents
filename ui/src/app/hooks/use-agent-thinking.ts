import { useEffect } from "react";

import useAgentThinkingStore from "../stores/agent-thinking-store";

export default function useAgentThinking() {
  const store = useAgentThinkingStore();

  useEffect(() => {
    store.loadModes();
  }, []);

  return store;
}
