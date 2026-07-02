// /api/stamp.js
// Vercel Serverless Function: vergibt einen Stempel für einen Kunden.
// Läuft serverseitig -> hat Zugriff auf den geheimen Clerk-Key und darf
// dadurch (im Gegensatz zum Browser) die Daten JEDES Nutzers ändern.
//
// Nötige Umgebungsvariablen in Vercel (Project Settings -> Environment Variables):
//   CLERK_SECRET_KEY   -> aus dem Clerk-Dashboard ("Secret Key", beginnt mit sk_test_ / sk_live_)
//   BETREIBER_PIN      -> deine 4-stellige PIN, z.B. 1234 (NICHT mehr im HTML/JS!)

import { createClerkClient } from '@clerk/backend';

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
const TOTAL_STAMPS = 10;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, pin } = req.body || {};

    if (!userId || !pin) {
      return res.status(400).json({ error: 'userId und pin sind erforderlich.' });
    }

    if (!process.env.BETREIBER_PIN || pin !== process.env.BETREIBER_PIN) {
      return res.status(403).json({ error: 'Falsche PIN.' });
    }

    const user = await clerkClient.users.getUser(userId);
    const current = parseInt(user.unsafeMetadata?.stamps) || 0;

    if (current >= TOTAL_STAMPS) {
      return res.status(200).json({ stamps: current, full: true });
    }

    const updated = current + 1;
    await clerkClient.users.updateUser(userId, {
      unsafeMetadata: { ...user.unsafeMetadata, stamps: updated }
    });

    return res.status(200).json({ stamps: updated, full: updated >= TOTAL_STAMPS });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Serverfehler beim Stempeln.' });
  }
}
