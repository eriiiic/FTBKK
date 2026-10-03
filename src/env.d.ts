declare namespace App {
  interface Locals {
    /** Set by middleware on /admin and /api/admin after the Access JWT is verified. */
    adminEmail?: string;
  }
}
