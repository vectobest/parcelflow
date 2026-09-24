export function notFoundHandler(message = 'Resource not found.') {
  return (req, res) => {
    res.status(404).json({ error: message, correlationId: req.correlationId });
  };
}
