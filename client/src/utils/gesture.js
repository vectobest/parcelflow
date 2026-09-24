// Where a flick would come to rest under the platform's scroll deceleration (0.998/ms), so a fast short flick still counts.
export function projectRest(position, velocityPxPerSec, deceleration = 0.998) {
  return position + (velocityPxPerSec / 1000) * deceleration / (1 - deceleration);
}

// Motion reports the last measured velocity even if the finger then held still; a pause before release means no fling.
export function releaseVelocity(velocity, lastMoveAt, now = performance.now(), staleAfterMs = 80) {
  return now - lastMoveAt > staleAfterMs ? 0 : velocity;
}
