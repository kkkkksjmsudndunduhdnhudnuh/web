# web

## Lokale Entwicklung

```
npm install
npm start
```

Startet den Server unter http://localhost:3000 und liefert die Website aus `public/`.
Ohne Redis-Konfiguration werden Terminanfragen und Feiertage lokal in `data/*.json` gespeichert.

Der Mitarbeiterbereich (`/staff.html`, verlinkt unten im Footer der Startseite) hat folgende Bereiche:

- **Termine**: Anfragen bestätigen/ablehnen (optional mit E-Mail an die Eltern), als erledigt markieren,
  suchen, filtern, Wochenansicht und CSV-Export. Anfragen werden 90 Tage nach dem Termin automatisch gelöscht.
- **Zeiten & Schließtage**: Öffnungszeiten (bestimmen Anzeige und buchbare Termine), Schließtage/Urlaub
  als Zeitraum und gesperrte Zeitfenster.
- **Hinweis**: Banner, das oben auf allen öffentlichen Seiten erscheint.
- **Team**: Mitarbeiter:innen für die Team-Seite anlegen, bearbeiten, sortieren, entfernen.
- **Konto**: eigenes Passwort ändern; Admins legen Konten für weitere Mitarbeiter:innen an.

Beim allerersten Start wird ein Admin-Konto angelegt – aus `STAFF_USERNAME`/`STAFF_PASSWORD`, falls gesetzt,
sonst mit dem bisherigen Login `bambini` / `bambini2024*`. Dieses vorläufige Passwort muss nach dem ersten
Login im Tab „Konto“ geändert werden. Passwörter werden mit scrypt gehasht gespeichert.

### Sicherheit des Mitarbeiterbereichs

- Der Login (`/api/login`) ist pro IP-Adresse auf 8 Versuche innerhalb von 15 Minuten begrenzt
  (HTTP 429 bei Überschreitung). Auch `/api/termine` ist pro IP auf 10 Anfragen pro Stunde begrenzt.
- Das Login-Cookie ist `HttpOnly`, `SameSite=Strict` und (bei HTTPS) `Secure`, gültig für 8 Stunden,
  und wird per HMAC-SHA256 signiert (siehe `SESSION_SECRET` unten).
- Ohne gesetztes `SESSION_SECRET` generiert der Server beim Start ein zufälliges, nur für diesen
  Prozess gültiges Geheimnis (mit Warnung im Log). Auf Vercel sollte `SESSION_SECRET` daher unbedingt
  gesetzt werden, sonst werden Logins bei jedem Cold Start ungültig.

## Deployment auf Vercel

Das Projekt ist Vercel-kompatibel: statische Seiten werden aus `public/` ausgeliefert, die API läuft
als Serverless Function (`api/index.js`, siehe `vercel.json`).

1. Projekt in Vercel importieren (Framework-Preset „Other“, kein Build-Schritt nötig).
2. **Redis-Datenbank verbinden**: Im Vercel-Dashboard unter „Storage“ → „Marketplace“ eine
   Redis-Integration (Upstash) hinzufügen und mit dem Projekt verbinden. Vercel setzt dadurch automatisch
   die Umgebungsvariablen `KV_REST_API_URL` / `KV_REST_API_TOKEN` (bzw. `UPSTASH_REDIS_REST_URL` /
   `UPSTASH_REDIS_REST_TOKEN`). Ohne diese Variablen würde die Serverless Function versuchen, lokale
   JSON-Dateien zu schreiben – das funktioniert auf Vercel nicht dauerhaft.
3. **Session-Secret setzen**: Umgebungsvariable `SESSION_SECRET` auf einen langen, zufälligen String setzen
   (z. B. `openssl rand -hex 32`). Damit werden die Login-Cookies des Mitarbeiterbereichs signiert.
4. **E-Mail (optional)**: Für Benachrichtigungen über neue Anfragen und Bestätigungs-/Absage-Mails an Eltern
   ein Konto bei [Resend](https://resend.com) anlegen, die Absender-Domain verifizieren und `RESEND_API_KEY`
   sowie `MAIL_FROM` (z. B. `Bambini Kinder Praxis <termine@bambinikinderpraxis.at>`) setzen.
   `NOTIFY_EMAIL` ändert die Empfängeradresse (Standard: office@bambinikinderpraxis.at).
   Die Benachrichtigung an die Praxis enthält bewusst keine Patientendaten.
5. Deployen. `/staff.html` und alle `/api/*`-Routen funktionieren danach wie lokal.
