import type { StatusBadgeView } from "@/types/sessions";

export default function StatusBadge({ badge }: { badge: StatusBadgeView }) {
  const Icon = badge.icon;
  return (
    <div className={badge.className}>
      <Icon size={16} aria-hidden="true" />
      <span>{badge.label}</span>
    </div>
  );
}
