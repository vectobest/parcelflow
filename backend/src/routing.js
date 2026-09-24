/**
 * Intentional compatibility surface. `frontend/app.js` imports this file
 * directly as a browser ES module so the control room keeps working as an
 * offline preview when the API is unreachable (see server-side static
 * routes). It re-exports the real implementation in `routing/RoutingEngine.js`
 * so there is exactly one routing implementation -- this file adds no logic
 * of its own, only a stable, browser-safe entry point.
 */
import { RoutingEngine, DEFAULT_POLICY, defaultRoutingRules } from './routing/RoutingEngine.js';

const engine = new RoutingEngine();

export { DEFAULT_POLICY, defaultRoutingRules };

export function routeParcel(parcel, policy = DEFAULT_POLICY, context = {}) {
  return engine.route(parcel, policy, context);
}

export function routeBatch(parcels, policy = DEFAULT_POLICY) {
  return engine.routeBatch(parcels, policy);
}
