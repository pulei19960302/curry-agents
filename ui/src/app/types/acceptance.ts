export type ProductAcceptanceItem = {
  key: string;
  title: string;
  category: string;
  status: "ready" | "needs_manual_check";
  evidence: string;
  verify_steps: string[];
  related_routes: string[];
};

export type ProductAcceptanceSummary = {
  total: number;
  ready: number;
  needs_manual_check: number;
};

export type ProductAcceptanceChecklistData = {
  summary: ProductAcceptanceSummary;
  items: ProductAcceptanceItem[];
};
