import { createHash } from "crypto";

// A short fingerprint of the stored password hash. It goes into the login token at
// sign-in and is compared on every server-side session check, so changing or
// resetting a password invalidates every session created with the old one.
// (It's a hash of a bcrypt hash, so it reveals nothing useful about the password.)
export function passwordVersion(passwordHash: string) {
  return createHash("sha256").update(passwordHash).digest("hex").slice(0, 16);
}
