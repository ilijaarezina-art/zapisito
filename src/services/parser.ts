export interface StavkaSpecifikacije {
  opis: string;
  kolicina?: string;
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
  tip_zabelezke?: 'posao' | 'nabavka' | 'zakazano';
}

/**
 * Specijalizovani brzi parser prilagođen za 3 vrste zabeleški:
 * 1. 'posao' - specifikacija materijala i radova sa sumom, klijentom i avansom
 * 2. 'nabavka' - lista artikala i količina za kupovinu u stovarištu/prodavnici
 * 3. 'zakazano' - zakazivanje radnog naloga: klijent, telefon, adresa, datum/vreme i napomena
 */
export function parsirajTekst(tekst: string, tipKonteksta: 'posao' | 'nabavka' | 'zakazano' = 'posao'): ParsiraniPodsetnik {
  const rez: ParsiraniPodsetnik = {
    klijent_ime: '',
    klijent_telefon: null,
    lokacija: '',
    iznos: 0,
    valuta: 'RSD',
    je_kapara: false,
    rok_datum: null,
    opis_zadatka: tekst.trim(),
    stavke: undefined,
    tip_zabelezke: tipKonteksta
  };

  const t = tekst.toLowerCase();

  // 1. TELEFON KLIJENTA
  const telMatch = tekst.match(/(?:\+381\s*0?6\d[\s\-\/]?\d{3}[\s\-\/]?\d{3,4}|06\d[\s\-\/]?\d{3}[\s\-\/]?\d{3,4})/i);
  if (telMatch) {
    rez.klijent_telefon = telMatch[0].replace(/[\s\-\/]/g, '');
  }

  // 2. KLIJENT ("kod Marka", "za Nikolu", "klijent Petar Petrović")
  const klijentMatch = t.match(/(?:kod|za|klijent)\s+([a-zšđčćž]+(?:\s+[a-zšđčćž]+)?)/i);
  if (klijentMatch && klijentMatch[1]) {
    const ime = klijentMatch[1].trim();
    if (!['mene', 'njega', 'nas', 'vas', 'posla', 'majstora', 'kuce', 'stana', 'radnje', 'prodavnice'].includes(ime.toLowerCase())) {
      rez.klijent_ime = ime.split(' ').map(rec => rec.charAt(0).toUpperCase() + rec.slice(1)).join(' ');
    }
  }

  // 3. LOKACIJA / ADRESA
  const lokMatch = t.match(/(?:u|na|adresa)\s+([a-zšđčćž0-9\s]+?)(?:,\s*|\s+(?:uzeo|kapara|cena|za|rok|sutra|u\s+\d|broj|$))/i);
  if (lokMatch && lokMatch[1]) {
    const moguca = lokMatch[1].trim();
    if (moguca.length > 2 && !['toku', 'radu', 'poslu', 'nabavci'].includes(moguca)) {
      rez.lokacija = moguca.charAt(0).toUpperCase() + moguca.slice(1);
    }
  }

  // 4. PARSIRANJE SPECIFIČNO ZA NABAVKU (LISTA ARTIKALA I KOLIČINA)
  if (tipKonteksta === 'nabavka') {
    // Deljenje po zarezima, tačkama ili rečima "i", "zatim", "plus"
    const delovi = tekst.split(/[,;\n]|\s+i\s+|\s+zatim\s+|\s+plus\s+/i);
    const artikli: StavkaSpecifikacije[] = [];

    delovi.forEach(deo => {
      const cistDeo = deo.trim();
      if (!cistDeo || cistDeo.length < 2) return;

      // Pokušaj izdvajanja količine: npr "3 dzaka cementa", "2 kante", "5 komada", "10m kabla"
      const kolMatch = cistDeo.match(/^(\d+(?:[.,]\d+)?)\s*(kom|komada|dzak|džak|džaka|džakova|kanta|kante|kanti|m|metara|kg|litara|l)?\s+(.+)$/i) ||
                       cistDeo.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(kom|komada|dzak|džak|džaka|džakova|kanta|kante|kanti|m|metara|kg|litara|l)?$/i);

      if (kolMatch) {
        if (/^\d/.test(cistDeo)) {
          const kolicinaStr = `${kolMatch[1]} ${kolMatch[2] || 'kom'}`.trim();
          const artikalNaziv = kolMatch[3].trim();
          artikli.push({
            opis: artikalNaziv.charAt(0).toUpperCase() + artikalNaziv.slice(1),
            kolicina: kolicinaStr,
            iznos: 0,
            valuta: 'RSD'
          });
        } else {
          const artikalNaziv = kolMatch[1].trim();
          const kolicinaStr = `${kolMatch[2]} ${kolMatch[3] || 'kom'}`.trim();
          artikli.push({
            opis: artikalNaziv.charAt(0).toUpperCase() + artikalNaziv.slice(1),
            kolicina: kolicinaStr,
            iznos: 0,
            valuta: 'RSD'
          });
        }
      } else {
        // Ako nema eksplicitne količine, stavljamo "1 kom"
        artikli.push({
          opis: cistDeo.charAt(0).toUpperCase() + cistDeo.slice(1),
          kolicina: '1 kom',
          iznos: 0,
          valuta: 'RSD'
        });
      }
    });

    if (artikli.length > 0) {
      rez.stavke = artikli;
      rez.opis_zadatka = `Lista za nabavku: ${artikli.map(a => `${a.opis} (${a.kolicina})`).join(', ')}`;
    }
    return rez;
  }

  // 5. PARSIRANJE ZA POSAO (SPECIFIKACIJA MATERIJALA/RADOVA + CENE + SUMA)
  // Detekcija višestrukih stavki sa cenama: npr "gips 3000 din, lepak 1500 din, rad 100 evra"
  const linijeStavki = tekst.split(/[,;\n]|\s+i\s+/i);
  const detektovaneStavke: StavkaSpecifikacije[] = [];
  let ukupnaSuma = 0;
  let dominantnaValuta: 'RSD' | 'EUR' = 'RSD';

  linijeStavki.forEach(lin => {
    const l = lin.trim();
    if (!l) return;
    const cenaMatch = l.match(/(.+?)\s+(\d+(?:[.,]\d+)?)\s*(eur|evr|evra|evro|€|din|rsd|hiljad|soma|som)?$/i);
    if (cenaMatch) {
      const opisStavke = cenaMatch[1].replace(/^(kupi|doneti|stavka|rad)\s+/i, '').trim();
      let cifra = parseFloat(cenaMatch[2].replace(',', '.'));
      const valJed = (cenaMatch[3] || '').toLowerCase();
      let stavkaValuta: 'RSD' | 'EUR' = 'RSD';

      if (['eur', 'evr', 'evra', 'evro', '€'].some(v => valJed.includes(v))) {
        stavkaValuta = 'EUR';
        dominantnaValuta = 'EUR';
      } else if (valJed.includes('som') || valJed.includes('hiljad')) {
        cifra *= 1000;
      }

      if (cifra > 0 && opisStavke.length > 1) {
        detektovaneStavke.push({
          opis: opisStavke.charAt(0).toUpperCase() + opisStavke.slice(1),
          iznos: cifra,
          valuta: stavkaValuta
        });
        ukupnaSuma += cifra;
      }
    }
  });

  if (detektovaneStavke.length > 0) {
    rez.stavke = detektovaneStavke;
    rez.iznos = ukupnaSuma;
    rez.valuta = dominantnaValuta;
  } else {
    // Pojedinačni iznos
    const eurMatch = t.match(/(\d+)\s*(?:eur|evr|evra|evro|€)/i);
    if (eurMatch) {
      rez.iznos = parseInt(eurMatch[1], 10);
      rez.valuta = 'EUR';
    } else {
      const rsdMatch = t.match(/(\d+)\s*(?:din|rsd)/i);
      if (rsdMatch) {
        rez.iznos = parseInt(rsdMatch[1], 10);
        rez.valuta = 'RSD';
      } else {
        const somMatch = t.match(/(\d+)\s*(?:soma|som|hiljad)/i);
        if (somMatch) {
          rez.iznos = parseInt(somMatch[1], 10) * 1000;
          rez.valuta = 'RSD';
        }
      }
    }
  }

  // Kapara / avans
  if (t.includes('kapar') || t.includes('avans') || t.includes('uzeo')) {
    rez.je_kapara = true;
  }

  // 6. DETEKCIJA VREMENA I ROKA (ZA ZAKAZANE POSLOVE)
  const sada = new Date();
  let ciljaniDatum: Date | null = null;

  if (t.includes('danas')) {
    ciljaniDatum = new Date(sada);
  } else if (t.includes('sutra')) {
    ciljaniDatum = new Date(sada);
    ciljaniDatum.setDate(sada.getDate() + 1);
  } else if (t.includes('prekosutra')) {
    ciljaniDatum = new Date(sada);
    ciljaniDatum.setDate(sada.getDate() + 2);
  } else {
    const dani = ['nedelj', 'ponedeljak', 'utorak', 'sred', 'četvrtak', 'petak', 'subot'];
    for (let i = 0; i < dani.length; i++) {
      if (t.includes(dani[i])) {
        ciljaniDatum = new Date(sada);
        const danasnjiDan = sada.getDay();
        let razlika = i - danasnjiDan;
        if (razlika <= 0) razlika += 7;
        ciljaniDatum.setDate(sada.getDate() + razlika);
        break;
      }
    }
  }

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
