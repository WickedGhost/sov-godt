# Sov godt – søvndagbok

En responsiv PWA-prototype for søvndagbok, mønsterinnsikt og behandlingsstøtte. Den bruker ikke eksterne biblioteker eller sender søvndata til en server.

## Kjør lokalt

Fra prosjektmappen:

```powershell
python -m http.server 8000
```

Åpne `http://localhost:8000`. For installasjon på mobil må appen publiseres på en HTTPS-adresse.

- **Android:** Åpne appen i Chrome og velg «Installer app» eller «Legg til på startsiden».
- **iPhone:** Åpne appen i Safari, trykk Del og velg «Legg til på Hjem-skjerm».

## Registrering

- Velg insomni, forsinket søvnfase eller begge under «Min plan». Valget tilpasser dagbokens spørsmål; det er ikke en diagnose.
- «I seng» starter et lokalt nattutkast. Kaffe, alkohol og lysbehandling kan stemples med ett trykk. Kaffe registreres i kopp-ekvivalenter (én kopp er satt til 80 mg koffein som standard), mens alkoholenheter kan legges til valgfritt.
- «Stått opp» avslutter nattutkastet. Åpne utkastet fra oversikten neste morgen for å kontrollere hendelser og fylle inn behandlingsrelevante søvndetaljer. «Lys av» og «Sovnet» fylles først med registrert leggetid, og «Siste oppvåkning» med registrert oppståtid; tidene kan endres før lagring.
- Hvis oppståtid ikke ble registrert, kan den legges til i utkastet før lagring. Hendelser og utkast bevares lokalt om appen lukkes.
- Klokkeslett velges med nettleserens klokkevelger. Under «Min plan» kan du velge om klokkeslett vises i 24- eller 12-timers format; eksporterte rapporter bruker 24-timers format.
- Søvnvinduet kan registreres og redigeres under «Min plan». Bruk tidene du har avtalt med behandleren; appen foreslår eller endrer ikke behandlingen.

## Prototypebegrensninger

- Første visning bruker tydelig merkede, fiktive eksempeldata. De erstattes når den første natten registreres.
- Registreringer og preferanser lagres lokalt i nettleseren. Det er ingen konto, klinikksynkronisering eller sikkerhetskopi.
- Eldre søvndagbokoppføringer beholdes når den nye hendelsesloggen tas i bruk. Nye nattutkast og hurtighendelser lagres separat fra den eldre dagboken.
- Innsiktene er enkle, lokale beregninger – ingen ekstern AI-tjeneste eller medisinsk vurdering.
- Påminnelser vises bare mens appen er åpen. Tidspunkt for lysbehandling og melatonin må følge avtale med behandler.
- Søvnvindu, søvnrestriksjon, lysbehandling og melatonin skal planlegges med kvalifisert helsepersonell.
- PDF-rapport åpnes i utskriftsdialogen; velg «Lagre som PDF». CSV kan eksporteres separat.
