import type { APIRoute } from 'astro';
import { REGISTRANT_TEMPLATE } from '../../lib/add-registrants';

// Admin only (guarded in middleware). The CSV to fill in for Registrations > Add people > Import.
export const GET: APIRoute = () =>
  new Response(`﻿${REGISTRANT_TEMPLATE}\r\n`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="registrants-template.csv"',
    },
  });
