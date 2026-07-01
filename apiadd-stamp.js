// api/add-stamp.js
// Diese Datei läuft NICHT im Browser, sondern auf dem Vercel-Server.
// Sie bekommt vom Handy des Betreibers die Kunden-ID und die eingegebene PIN,
// prüft die PIN geheim auf dem Server und vergibt danach den Stempel im
// Konto des Kunden – unabhängig davon, wer gerade auf dem scannenden
// Handy eingeloggt ist.

const TOTAL_STAMPS = 10;

export default async function handler(req, res) {
  // CORS: erlaubt Aufrufe von deiner eigenen Domain aus dem Browser
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Nur POST erlaubt' });
  }

  const { userId, pin } = req.body || {};

  if (!userId || !pin) {
    return res.status(400).json({ error: 'userId und pin sind erforderlich' });
  }

  // PIN wird NUR auf dem Server verglichen (Umgebungsvariable, siehe Anleitung)
  if (pin !== process.env.BETREIBER_PIN) {
    return res.status(401).json({ error: 'Falsche PIN' });
  }

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    return res.status(500).json({ error: 'Server nicht korrekt konfiguriert (CLERK_SECRET_KEY fehlt)' });
  }

  try {
    // Aktuellen Nutzer von Clerk holen
    const getResp = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Bearer ${secretKey}` }
    });

    if (!getResp.ok) {
      return res.status(404).json({ error: 'Kunde nicht gefunden' });
    }

    const user = await getResp.json();
    const currentStamps = parseInt(user?.unsafe_metadata?.stamps) || 0;

    if (currentStamps >= TOTAL_STAMPS) {
      return res.status(200).json({ stamps: currentStamps, full: true, message: 'Karte ist bereits voll' });
    }

    const newStamps = currentStamps + 1;

    // Stempel-Zahl aktualisieren, restliche unsafe_metadata beibehalten
    const patchResp = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(userId)}/metadata`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        unsafe_metadata: {
          ...(user.unsafe_metadata || {}),
          stamps: newStamps
        }
      })
    });

    if (!patchResp.ok) {
      const errText = await patchResp.text();
      return res.status(500).json({ error: 'Update fehlgeschlagen', details: errText });
    }

    return res.status(200).json({
      stamps: newStamps,
      full: newStamps >= TOTAL_STAMPS
    });
  } catch (err) {
    return res.status(500).json({ error: 'Serverfehler', details: String(err) });
  }
}
