export interface StavkaSpecifikacije {
  opis: string;
  iznos: number;
  valuta: 'RSD' | 'EUR';
}

export interface ParsiraniPodsetnik {
  klijent_ime: string;
  klijent_telefon?: string | null;
  lokacija: string;
  iznos: number;
  valuta: 'RSD' | 'EUR';
  je_kapara: boolean;
  rok_datum: string | null;
  opis_zadatka: string;
  stavke?: StavkaSpecifikacije[];
}

/**
 * Brzi lokalni parser govora za balkanski majstorski sleng (Opcija B - bez AI troškova).
 * Podržava:
 * - Ime i broj telefona klijenta (06... ili +381...)
 * - Pojedinačne poslove ("kod Zorana uzeo 4 soma")
 * - Višestruke stavke / specifikaciju materijala i radova ("gvoždje 10kg 3000 din, cement 20 džakova 20000 din...")
 * - Automatsko sumiranje svih stavki u ukupnu cifru
 * Izvršava se u ~5ms.
 */
export function parsirajTekst(tekst: string): ParsiraniPodsetnik {
  const rez: ParsiraniPodsetnik = {
    klijent_ime: '',
    klijent_telefon: null,
    lokacija: '',
    iznos: 0,
    valuta: 'RSD',
    je_kapara: false,
    rok_datum: null,
    opis_zadatka: tekst.trim(),
    stavke: undefined
  };

  const t = tekst.toLowerCase();

  // 1. DETEKCIJA BROJA TELEFONA KLIJENTA (06... ili +38106...)
  const telMatch = tekst.match(/(?:\+381\s*0?6\d[\s\-\/]?\d{3}[\s\-\/]?\d{3,4}|06\d[\s\-\/]?\d{3}[\s\-\/]?\d{3,4})/i);
  if (telMatch) {
    const ciscen = telMatch[0].replace(/[\s\-\/]/g, '');
    rez.klijent_telefon = ciscen;
  }

  // 2. DETEKCIJA KLIJENTA ("kod Zorana", "kod majstora Milana", "za Dragana")
  const klijentMatch = t.match(/(?:kod|za)\s+(?:majstora\s+)?([a-zšđčćž]+)/i);
  if (klijentMatch && klijentMatch[1]) {
    const ime = klijentMatch[1];
    // Ignorišemo ako je zamenica ili opšta reč
    if (!['mene', 'njega', 'nas', 'vas', 'posla', 'majstora', 'kuce', 'stana'].includes(ime.toLowerCase())) {
      rez.klijent_ime = ime.charAt(0).toUpperCase() + ime.slice(1);
    }
  }

  // 3. DETEKCIJA LOKACIJE ("na Vračaru", "u Zemunu", "u Borči", "na Dorćolu")
  const lokacijaMatch = t.match(/(?:na|u)\s+([a-zšđčćž]+(?:u|i|om|em))/i);
  if (lokacijaMatch && lokacijaMatch[1]) {
    const lok = lokacijaMatch[1];
    if (!['ponedeljak', 'utorak', 'sredu', 'četvrtak', 'petak', 'subotu', 'nedelju', 'poslu', 'bazi'].includes(lok.toLowerCase())) {
      rez.lokacija = lok.charAt(0).toUpperCase() + lok.slice(1);
    }
  }

  // 4. DETEKCIJA KAPARE
  if (t.includes('kapar')) {
    rez.je_kapara = true;
  }

  // 5. DETEKCIJA VIŠESTRUKIH STAVKI / SPECIFIKACIJE SA SUMIRANJEM
  // Primer:
  // "gvoždje 10 kg oko 3000 din
  // cement 20 džakova 20000 dinara
  // šljunak 4 kubika 8000 dinara"
  const cenaMatcher = /(?:oko\s+|ukupno\s+|cena\s+)?(\d+(?:[.,]\d+)?)\s*(dinara|din|rsd|evra|eura|eur|evrića|evri|soma|som|crvene|crvenih|hiljada|hiljade)\b/i;
  
  // Prvo probamo razdvajanje po novim redovima, zarezima ili tačka-zarezima
  const delovi = tekst.split(/[\n\r;,]+/).map(d => d.trim()).filter(Boolean);
  let pronadjeneStavke: StavkaSpecifikacije[] = [];

  for (const deo of delovi) {
    const m = deo.match(cenaMatcher);
    if (m) {
      let stavkaIznos = parseFloat(m[1].replace(',', '.'));
      let stavkaValuta: 'RSD' | 'EUR' = 'RSD';
      const unit = m[2].toLowerCase();

      if (['evra', 'eura', 'eur', 'evrića', 'evri'].includes(unit)) {
        stavkaValuta = 'EUR';
      } else if (['soma', 'som', 'crvene', 'crvenih', 'hiljada', 'hiljade'].includes(unit)) {
        stavkaIznos = stavkaIznos * 1000;
      }

      let stavkaOpis = deo
        .replace(m[0], '')
        .replace(/^[•*\-\d.)\s]+/, '')
        .replace(/(?:oko|ukupno|cena)\s*$/i, '')
        .trim();

      // Ako je na početku deo sa klijentom, očisti ga
      stavkaOpis = stavkaOpis.replace(/(?:kod|za)\s+(?:majstora\s+)?[a-zšđčćž]+/i, '').trim();
      if (rez.klijent_telefon) {
        stavkaOpis = stavkaOpis.replace(rez.klijent_telefon, '').trim();
      }

      if (stavkaOpis.length >= 2) {
        pronadjeneStavke.push({
          opis: stavkaOpis.charAt(0).toUpperCase() + stavkaOpis.slice(1),
          iznos: stavkaIznos,
          valuta: stavkaValuta
        });
      }
    }
  }

  // Ako nije bilo novih redova ili zareza (npr. neprekidno diktiranje u govoru),
  // probamo globalno prepoznavanje rečenica sa cenama
  if (pronadjeneStavke.length < 2) {
    const globalRegex = /([a-zšđčćž0-9\s\.\-]+?)(?:oko\s+|ukupno\s+|cena\s+)?(\d+(?:[.,]\d+)?)\s*(dinara|din|rsd|evra|eura|eur|evrića|evri|soma|som|crvene|crvenih|hiljada|hiljade)\b/gi;
    const globalMatches: StavkaSpecifikacije[] = [];
    let match: RegExpExecArray | null;

    while ((match = globalRegex.exec(tekst)) !== null) {
      let stavkaIznos = parseFloat(match[2].replace(',', '.'));
      let stavkaValuta: 'RSD' | 'EUR' = 'RSD';
      const unit = match[3].toLowerCase();

      if (['evra', 'eura', 'eur', 'evrića', 'evri'].includes(unit)) {
        stavkaValuta = 'EUR';
      } else if (['soma', 'som', 'crvene', 'crvenih', 'hiljada', 'hiljade'].includes(unit)) {
        stavkaIznos = stavkaIznos * 1000;
      }

      let stavkaOpis = match[1]
        .replace(/^[•*\-\d.)\s]+/, '')
        .replace(/(?:oko|ukupno|cena)\s*$/i, '')
        .trim();

      stavkaOpis = stavkaOpis.replace(/(?:kod|za)\s+(?:majstora\s+)?[a-zšđčćž]+/i, '').trim();
      if (rez.klijent_telefon) {
        stavkaOpis = stavkaOpis.replace(rez.klijent_telefon, '').trim();
      }

      if (stavkaOpis.length >= 2) {
        globalMatches.push({
          opis: stavkaOpis.charAt(0).toUpperCase() + stavkaOpis.slice(1),
          iznos: stavkaIznos,
          valuta: stavkaValuta
        });
      }
    }

    if (globalMatches.length >= 2) {
      pronadjeneStavke = globalMatches;
    }
  }

  // Ako imamo 2 ili više stavki, imamo punu SPECIFIKACIJU sa automatskim sabiranjem!
  if (pronadjeneStavke.length >= 2) {
    rez.stavke = pronadjeneStavke;
    rez.iznos = pronadjeneStavke.reduce((ukupno, s) => ukupno + s.iznos, 0);
    rez.valuta = pronadjeneStavke.every(s => s.valuta === 'EUR') ? 'EUR' : 'RSD';
    rez.opis_zadatka = pronadjeneStavke.map(s => `${s.opis} (${s.iznos.toLocaleString('sr-RS')} ${s.valuta})`).join(', ');
  } else {
    // 6. STANDARDNA DETEKCIJA JEDNOG IZNOSA (npr. samo "4 soma", "50 evra", "2000 din")
    // A. Evri
    const eurMatch = t.match(/(\d+(?:[.,]\d+)?)\s*(?:evra|eura|eur|evrića|evri|e)/i);
    if (eurMatch) {
      rez.iznos = parseFloat(eurMatch[1].replace(',', '.'));
      rez.valuta = 'EUR';
    } else {
      // B. Sleng: "4 soma", "2 crvene"
      const somMatch = t.match(/(\d+)\s*(?:soma|som|crvene|crvenih|hiljada|hiljade)/i);
      if (somMatch) {
        rez.iznos = parseInt(somMatch[1], 10) * 1000;
        rez.valuta = 'RSD';
      } else {
        // C. Standardni dinari: "4000 dinara", "2500 din"
        const dinMatch = t.match(/(\d+)\s*(?:dinara|din)/i);
        if (dinMatch) {
          rez.iznos = parseInt(dinMatch[1], 10);
          rez.valuta = 'RSD';
        } else {
          // Samo broj ako prethodi 'naplatio', 'uzeo', 'ruke'
          const naplatioMatch = t.match(/(?:naplatio|uzeo|ostao dužan|ruke)\s+(\d+)/i);
          if (naplatioMatch) {
            rez.iznos = parseInt(naplatioMatch[1], 10);
            rez.valuta = 'RSD';
          }
        }
      }
    }

    // Detekcija zadatka kod običnih unosa
    const zadatakRegex = /(?:treba da|moram da|dužan sam|zadatak|kupiti|doneti|radovi|rad)\s+([^.]+)/i;
    const zadatakMatch = t.match(zadatakRegex);
    if (zadatakMatch && zadatakMatch[1]) {
      rez.opis_zadatka = zadatakMatch[1].trim();
    }
  }

  // 7. DETEKCIJA VREMENA / ROKA
  const sada = new Date();
  let ciljaniDatum: Date | null = null;

  if (t.includes('sutra')) {
    ciljaniDatum = new Date(sada);
    ciljaniDatum.setDate(sada.getDate() + 1);
  } else if (t.includes('prekosutra')) {
    ciljaniDatum = new Date(sada);
    ciljaniDatum.setDate(sada.getDate() + 2);
  } else {
    // Dani u nedelji
    const dani = ['nedelj', 'ponedeljak', 'utorak', 'sred', 'četvrtak', 'petak', 'subot'];
    for (let i = 0; i < dani.length; i++) {
      if (t.includes(dani[i])) {
        ciljaniDatum = new Date(sada);
        const danasnjiDan = sada.getDay();
        let razlika = i - danasnjiDan;
        if (razlika <= 0) razlika += 7; // Sledeći put taj dan
        ciljaniDatum.setDate(sada.getDate() + razlika);
        break;
      }
    }
  }

  // Detekcija sati (npr. "u 10", "u 14h", "u 9 ujutru")
  if (ciljaniDatum) {
    const satiMatch = t.match(/u\s+(\d{1,2})(?:h|:\d{2})?/i);
    if (satiMatch) {
      const sati = parseInt(satiMatch[1], 10);
      if (sati >= 0 && sati <= 23) {
        ciljaniDatum.setHours(sati, 0, 0, 0);
      }
    } else if (t.includes('ujutru')) {
      ciljaniDatum.setHours(9, 0, 0, 0);
    } else if (t.includes('popodne')) {
      ciljaniDatum.setHours(17, 0, 0, 0);
    }
    rez.rok_datum = ciljaniDatum.toISOString();
  }

  return rez;
}
