# Pošiljanje e-poštnih sporočil na Railway (Google Apps Script webhook)

## Problem

Railway na osnovnem (in večini) planov blokira odhodne povezave na standardne
SMTP porte (25, 465, 587). To pomeni, da direktna povezava iz `server.js` na
`smtp.gmail.com:587` ne bo delovala in bo kontakt forma (`kontakt.html`) ter
forma za testno naročilo (`test.html`) padli z napako, ko poskušata poslati
e-pošto.

Rešitev je, da e-pošto ne pošiljamo prek SMTP, ampak prek navadne HTTPS
zahteve (ki na Railwayu ni blokirana) na majhen **Google Apps Script**, ki
deluje kot webhook in dejansko pošlje e-pošto prek Gmaila.

`server.js` to že podpira: če je nastavljena spremenljivka `MAIL_WEBHOOK_URL`,
se e-pošta pošlje prek HTTPS webhooka namesto prek SMTP (glej funkcijo
`sendSmtpMail` v `server.js`).

## Korak 1: Ustvari Google Apps Script projekt

1. Pojdi na [script.google.com](https://script.google.com) in se prijavi z
   Google/Gmail računom, s katerega želiš pošiljati e-pošto (npr.
   `agenttuval@gmail.com` ali `sales@tu-val.si`, če gre za Google Workspace).
2. Klikni **New project** (Nov projekt).
3. Poimenuj projekt, npr. `CleanSpace Mail Webhook`.
4. Zbriši privzeto vsebino datoteke `Code.gs` in vnesi kodo iz koraka 2 spodaj.

## Korak 2: Koda za `doPost(e)`

Vnesi spodnjo kodo v `Code.gs`. Skript preveri skupno skrivnost (secret),
prebere podatke iz JSON telesa zahteve in pošlje e-pošto prek `MailApp` (oz.
`GmailApp`).

```javascript
// Nastavi svojo skrivnost - mora biti enaka vrednosti MAIL_WEBHOOK_SECRET
// v Railway spremenljivkah.
const WEBHOOK_SECRET = "vstavi-svojo-nakljucno-skrivnost-tukaj";

// Privzeti naslov prejemnika, če ga zahteva ne pošlje.
const DEFAULT_TO = "sales@tu-val.si";

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse(400, { ok: false, message: "Manjka telo zahteve." });
    }

    const data = JSON.parse(e.postData.contents);

    // Preveri skupno skrivnost, da webhooka ne more klicati kdorkoli.
    if (!WEBHOOK_SECRET || data.secret !== WEBHOOK_SECRET) {
      return jsonResponse(401, { ok: false, message: "Neveljavna skrivnost." });
    }

    const to = data.to || DEFAULT_TO;
    const subject = data.subject || "Sporočilo s spletne strani";
    const body = data.text || "";
    const replyTo = data.replyTo || "";

    const options = {};
    if (replyTo) options.replyTo = replyTo;
    if (data.from) options.name = data.from;

    MailApp.sendEmail({
      to: to,
      subject: subject,
      body: body,
      ...options,
    });

    return jsonResponse(200, { ok: true });
  } catch (error) {
    return jsonResponse(500, { ok: false, message: String(error) });
  }
}

function jsonResponse(status, payload) {
  // Apps Script Web App ne dopušča nastavljanja HTTP statusa, zato ga
  // vrnemo samo v telesu odgovora. server.js preveri "ok" polje v JSON-u.
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}
```

> Nasvet: `WEBHOOK_SECRET` naj bo dolg, naključen niz (npr. generiran z
> `openssl rand -hex 32`). Uporabi isto vrednost tudi v Railway spremenljivki
> `MAIL_WEBHOOK_SECRET`.

## Korak 3: Deploy kot Web App

1. V Apps Script uredniku klikni **Deploy** → **New deployment**.
2. Pri "Select type" izberi **Web app**.
3. Nastavi:
   - **Execute as**: `Me` (tvoj Google račun, s katerega se dejansko pošilja
     e-pošta).
   - **Who has access**: `Anyone` (ker Railway dostopa anonimno prek HTTPS;
     varnost zagotavlja `WEBHOOK_SECRET`, ne Google prijava).
4. Klikni **Deploy**.
5. Google bo morda zahteval, da odobriš dovoljenja (pošiljanje e-pošte v
   tvojem imenu) - to potrdi.
6. Po uspešnem deployu boš dobil **Web app URL**, ki je videti takole:
   `https://script.google.com/macros/s/AKfycb.../exec`
   To je URL, ki ga potrebuješ za `MAIL_WEBHOOK_URL`.

> Če kasneje spremeniš kodo skripta, moraš narediti **nov deployment** (ali
> urediti obstoječega prek **Deploy** → **Manage deployments** → svinčnik →
> **New version**), da se spremembe uveljavijo na istem URL-ju.

## Korak 4: Nastavi Railway spremenljivke

V Railway projektu (Settings → Variables) dodaj:

| Spremenljivka         | Vrednost                                                    |
| ---------------------- | ------------------------------------------------------------ |
| `MAIL_WEBHOOK_URL`     | URL iz koraka 3, npr. `https://script.google.com/macros/s/AKfycb.../exec` |
| `MAIL_WEBHOOK_SECRET`  | Isti naključni niz, ki ga uporabiš v `WEBHOOK_SECRET` v skriptu |

Aplikacija samodejno zazna `MAIL_WEBHOOK_URL` in preklopi na pošiljanje prek
HTTPS webhooka namesto SMTP - glej `mailWebhookConfig()` in `sendSmtpMail()`
v `server.js`. Ko je `MAIL_WEBHOOK_URL` nastavljen, se SMTP koda sploh ne
uporabi več.

Po nastavitvi spremenljivk Railway samodejno znova zažene servis. Preveri
delovanje na `/api/mail-status` (npr.
`https://<tvoja-railway-domena>/api/mail-status`) - polje `mode` naj bo
`"webhook"`, `hasWebhookUrl` in `hasWebhookSecret` naj bosta `true`.

## Korak 5: Testiraj

1. Odpri `kontakt.html` ali `test.html` na svoji Railway domeni.
2. Izpolni in oddaj formo.
3. Preveri, da e-pošta prispe na naslov, nastavljen v `MAIL_FROM`/prejemniku
   (`sales@tu-val.si` po privzetih nastavitvah).
4. Če se pojavi napaka, preveri Railway logove (`server.js` izpiše sporočilo
   napake, ki vključuje odgovor iz Apps Scripta).

## Pogosta vprašanja

**Zakaj ne uporabim kar Gmail SMTP z app geslom?**
Railway na tem planu blokira odhodne povezave na SMTP porte (25/465/587), ne
glede na to, ali je geslo pravilno. Zato je edina zanesljiva pot prek
navadnega HTTPS zahtevka, kar Google Apps Script omogoča.

**Ali lahko uporabim tudi drug ponudnik namesto Google Apps Script (npr.
SendGrid, Mailgun, Resend)?**
Da - `MAIL_WEBHOOK_URL` je splošen mehanizem. Dokler ciljni endpoint sprejme
POST z JSON telesom `{ secret, from, to, subject, text, replyTo }` in vrne
JSON `{ ok: true }` ali `{ ok: false, message }`, bo deloval. Google Apps
Script je opisan tukaj, ker je brezplačen in ne zahteva dodatnega računa.

**Ali app geslo (Gmail App Password) sploh še potrebujem?**
Ne, če uporabljaš webhook. `MAIL_WEBHOOK_URL` ima prednost pred SMTP
nastavitvami v `server.js`, zato lahko `SMTP_PASS`/`GMAIL_APP_PASSWORD`
odstraniš, ko webhook deluje.
