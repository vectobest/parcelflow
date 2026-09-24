import { Passport } from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

/**
 * Wires real Google OAuth 2.0 (master prompt: "keep OAuth"). Only
 * registered when GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET are configured --
 * see docs/decisions/ADR-006 for why an unconfigured OAuth app falls back
 * to a clearly-labeled local dev sign-in instead of a broken "Sign in
 * with Google" button.
 *
 * Uses a fresh `Passport` instance rather than the package's default
 * singleton export: the singleton accumulates serializers/strategies
 * globally across every call, which silently breaks the moment more than
 * one container exists in the same process (every test file that spins
 * up its own app, for a start).
 */
export function configurePassport({ config, userStore }) {
  const passport = new Passport();
  passport.serializeUser((user, done) => done(null, user.email));
  passport.deserializeUser((email, done) => {
    const user = userStore.get(email);
    done(null, user || false);
  });

  if (config.oauthEnabled) {
    passport.use(new GoogleStrategy(
      { clientID: config.googleClientId, clientSecret: config.googleClientSecret, callbackURL: config.googleCallbackUrl },
      (_accessToken, _refreshToken, profile, done) => {
        const email = profile.emails?.[0]?.value;
        if (!email) return done(new Error('Google did not return an email address for this account.'));
        const user = userStore.findOrCreate({ email, name: profile.displayName, avatarUrl: profile.photos?.[0]?.value, provider: 'google' });
        done(null, user);
      }
    ));
  }

  return passport;
}
