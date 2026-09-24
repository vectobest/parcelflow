export function notFoundHandler() {
  return (req, res) => res.status(404).json({ error: 'Route not found.', correlationId: req.correlationId });
}
