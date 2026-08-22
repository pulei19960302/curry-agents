export default function StatusField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div>{label}</div>
      <div>{value}</div>
    </div>
  );
}
