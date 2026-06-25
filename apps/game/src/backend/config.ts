/**
 * Live backend wiring for the daily percentile. Deliberately dependency-free —
 * we call the Cloud Functions callable over plain HTTPS (see daily.ts) rather
 * than pulling the heavy Firebase JS SDK into the frozen Expo graph.
 *
 * The web apiKey below is a PUBLIC client identifier, not a secret: Firebase web
 * keys identify the project, and security is enforced by the function's in-app
 * auth check (`requireUid`) + default-deny Firestore rules — never by hiding the
 * key. Safe to commit. (When App Check lands, it gates abuse — see docs/ROADMAP.)
 */

/** Master switch — off ⇒ the app never calls the network and the Summary shows the local rating only. */
export const BACKEND_ENABLED = true;

const PROJECT_ID = "twenty-something-anthonydm";
const REGION = "us-central1";
const API_KEY = "AIzaSyCCwowd8pWuWlwpJ84WP35TwMR-NEA-Zi8";

/** Callable Cloud Function URL (2nd-gen, via the cloudfunctions.net alias). */
export const fnUrl = (name: string): string => `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/${name}`;

/** Identity Toolkit: create an anonymous user / token. */
export const SIGNUP_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`;
/** Secure Token: exchange a refresh token for a fresh ID token. */
export const REFRESH_URL = `https://securetoken.googleapis.com/v1/token?key=${API_KEY}`;
