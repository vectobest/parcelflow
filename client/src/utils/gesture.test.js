import { projectRest, releaseVelocity } from './gesture.js';

describe('projectRest', () => {
  it('returns the position unchanged when there is no velocity', () => {
    expect(projectRest(-60, 0)).toBe(-60);
  });

  it('carries a flick well past the release point in its direction of travel', () => {
    // 1000px/s under 0.998 deceleration coasts ~499px.
    expect(projectRest(-70, -1000)).toBeCloseTo(-569, 0);
    expect(projectRest(-200, 1000)).toBeCloseTo(299, 0);
  });
});

describe('releaseVelocity', () => {
  it('keeps the velocity when the last move was recent', () => {
    expect(releaseVelocity(-900, 1000, 1050)).toBe(-900);
  });

  it('treats a pause before release as zero velocity', () => {
    expect(releaseVelocity(-900, 1000, 1200)).toBe(0);
  });
});
