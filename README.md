# CleanSpace (Tu-Val)

Statična spletna stran s Node.js strežnikom (`server.js`), ki poleg
strežbe datotek skrbi tudi za admin urejevalnik vsebine, Vasco integracijo
in pošiljanje e-poštnih sporočil iz kontakt forme (`kontakt.html`) in forme
za testno naročilo (`test.html`).

## Zagon

```bash
npm install
npm start
```

Strežnik privzeto teče na vratih `4173` (nastavljivo prek `PORT`).

## Pošiljanje e-pošte na Railway

Railway na tem planu blokira odhodne SMTP povezave (npr. do
`smtp.gmail.com:587`), zato direktno SMTP pošiljanje iz `server.js` na
Railwayu ne deluje in kontakt forma ter forma za testno naročilo padeta z
napako.

Rešitev: nastavi `MAIL_WEBHOOK_URL` (in `MAIL_WEBHOOK_SECRET`) v Railway
spremenljivkah, aplikacija pa bo e-pošto pošiljala prek navadne HTTPS
zahteve na Google Apps Script webhook namesto prek blokiranega SMTP porta.

Podrobna navodila, kako postaviti in deployati Google Apps Script webhook
ter primer kode za `doPost(e)`, najdeš v
[`docs/email-setup.md`](docs/email-setup.md).

Ko je `MAIL_WEBHOOK_URL` nastavljen, lahko preveriš status pošiljanja na
`/api/mail-status` - polje `mode` naj vrne `"webhook"`.
