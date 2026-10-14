# Pravila i instrukcije za rad na projektu ZapišiTo

## 1. GitHub & cPanel Web Deployment Pravilo (STRIKTNO I OBAVEZNO)
Svaka nova dorada, funkcionalnost ili ispravka u aplikaciji mora biti verifikovana i **odmah podignuta na GitHub** kako bi korisnik mogao da povuče izmene na cPanel hosting i prvo testira sve na webu:
1. **Verifikacija i kompajliranje Web bundle-a:**
   `cmd /c npx.cmd expo export --platform web`
2. **Sinhronizacija web distribucije u koren repozitorijuma:**
   Ukloniti stare web bundle fajlove iz `_expo/static/js/web/*.js` i iskopirati sveže fajlove iz `dist/*` u koren repozitorijuma (`_expo/`, `index.html`, `favicon.ico`).
3. **Commit i Push na GitHub (`origin main`):**
   `git add -A`
   `git commit -m "..."`
   `git -c http.sslVerify=false push origin main`

## 2. Zabrana automatskog pravljenja Android Build-a (STRIKTNO)
- **NIKADA ne pokretati EAS build (`eas build`, `npx eas-cli build`) automatski.**
- Sve izmene se uvek prvo puštaju na GitHub i cPanel za web testiranje.
- Tek kada korisnik pregleda i testira na webu, i eksplicitno zatraži ("napravi build"), sme se pokrenuti EAS build.

## 3. Dual-Platform Parity & 100% Besplatna Rešenja
- Sve funkcionalnosti moraju raditi i na Web pretraživačima i u Native Android aplikaciji.
- Nema plaćenih API servisa – koristi se isključivo nativno prepoznavanje govora (Web Speech API / `expo-speech-recognition`), lokalno procesiranje i sopstveni backend.
