export default function Badge({ tone, children }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
