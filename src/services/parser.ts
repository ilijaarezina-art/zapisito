import { StavkaSpecifikacije } from './storage';

export interface ParsiraniPodsetnik {
  naslov?: string;
  klijent_ime: string;
  klijent_telefon?: string | null;
  lokacija: string;
  iznos: number;
  valuta: 'RSD' | 'EUR';
  obracunaj_pdv?: boolean;
  pdv_procenat?: number;
  pdv_iznos?: number;
  ukupno_sa_pdv?: number;
  je_kapara: boolean;
  kapara_iznos?: number;
  rok_datum: string | null;
  opis_zadatka: string;
  napomene?: string;
  stavke?: StavkaSpecifikacije[];
  tip_zabelezke: 'posao' | 'nabavka' | 'zakazano';
}

/**
 * Normalizacija jedinice mere u standardnu skraćenicu
 */
function normalizujJedinicuMere(jed: string): string {
  const j = jed.toLowerCase().trim();
  if (['m2', 'm²', 'kvadrat', 'kvadrata', 'kvadrata', 'kv'].includes(j)) return 'm²';
  if (['kg', 'kilo', 'kila', 'kilogram', 'kilograma'].includes(j)) return 'kg';
  if (['kom', 'komada', 'komad'].includes(j)) return 'kom';
  if (['pak', 'pakovanje', 'pakovanja', 'paket'].includes(j)) return 'pak';
  if (['m', 'metar', 'metara', 'metra'].includes(j)) return 'm';
  if (['l', 'litar', 'litara', 'litra'].includes(j)) return 'l';
  if (['g', 'gr', 'gram', 'grama'].includes(j)) return 'gr';
  if (['glavica', 'glavice', 'glavica'].includes(j)) return 'glavice';
  if (['dzak', 'džak', 'dzaka', 'džaka', 'dzakova', 'džakova', 'vreca', 'vreća'].includes(j)) return 'džak';
  if (['kanta', 'kante', 'kanti'].includes(j)) return 'kanta';
  if (['flasa', 'flaša', 'flase', 'flaše'].includes(j)) return 'flaša';
  if (['veza', 'veze'].includes(j)) return 'veza';
  return j || 'kom';
}

/**
 * Pametni parser prilagođen za 3 vrste zabeleški:
 * 1. 'posao' - specifikacija materijala i radova (tabela: Br, Opis, Jed. mere, Količina, Jed. cena, Ukupno, PDV)
 * 2. 'nabavka' - lista za kupovinu artikala i količina (tabela: ✓, Namirnica, Količina, Cena procena, Korpa)
 * 3. 'zakazano' - radni nalog/termin (Ime, Telefon, Adresa/Grad, Datum/Vreme, Napomena)
 */
export function parsirajTekst(tekst: string, tipKonteksta: 'posao' | 'nabavka' | 'zakazano' = 'posao'): ParsiraniPodsetnik {
  const rez: ParsiraniPodsetnik = {
    naslov: '',
    klijent_ime: '',
    klijent_telefon: null,
    lokacija: '',
    iznos: 0,
    valuta: 'RSD',
    obracunaj_pdv: true,
    pdv_procenat: 20,
    pdv_iznos: 0,
    ukupno_sa_pdv: 0,
    je_kapara: false,
    kapara_iznos: 0,
    rok_datum: null,
    opis_zadatka: tekst.trim(),
    napomene: '',
    stavke: [],
    tip_zabelezke: tipKonteksta
  };

  if (!tekst || !tekst.trim()) return rez;

  const t = tekst.toLowerCase();

  // 1. DETEKCIJA TELEFONA KLIJENTA
  const telMatch = tekst.match(/(?:\+381\s*0?6\d[\s\-\/]?\d{3}[\s\-\/]?\d{3,4}|06\d[\s\-\/]?\d{3}[\s\-\/]?\d{3,4})/i);
  if (telMatch) {
    rez.klijent_telefon = telMatch[0].replace(/[\s\-\/]/g, '');
  }

  // 2. DETEKCIJA KLIJENTA ("kod Marka", "za Nikolu", "klijent Petar Petrović", "kupac...")
  const klijentMatch = t.match(/(?:kod|za|klijent|kupac|investitor)\s+([a-zšđčćž]+(?:\s+[a-zšđčćž]+)?)/i);
  if (klijentMatch && klijentMatch[1]) {
    const ime = klijentMatch[1].trim();
    if (!['mene', 'njega', 'nas', 'vas', 'posla', 'majstora', 'kuce', 'stana', 'radnje', 'prodavnice', 'nabavku', 'materijal'].includes(ime.toLowerCase())) {
      rez.klijent_ime = ime.split(' ').map(rec => rec.charAt(0).toUpperCase() + rec.slice(1)).join(' ');
    }
  }

  // Ako nije nađeno "kod..." a jeste kontekst 'zakazano', često prve reči budu ime i prezime
  if (!rez.klijent_ime && tipKonteksta === 'zakazano') {
    const prveDveReci = tekst.trim().split(/[\s,]+/);
    if (prveDveReci.length >= 2) {
      const prva = prveDveReci[0].replace(/[^a-zA-ZšđčćžŠĐČĆŽ]/g, '');
      const druga = prveDveReci[1].replace(/[^a-zA-ZšđčćžŠĐČĆŽ]/g, '');
      if (prva.length > 2 && druga.length > 2 && !['sutra', 'danas', 'zakazi', 'zakazano', 'treba', 'posao', 'rad'].includes(prva.toLowerCase())) {
        rez.klijent_ime = `${prva.charAt(0).toUpperCase() + prva.slice(1)} ${druga.charAt(0).toUpperCase() + druga.slice(1)}`;
      }
    }
  }

  // 3. DETEKCIJA LOKACIJE / ADRESE ("u Smederevu", "na adresi Knez Mihailova 12", "ulica...", "grad...")
  const lokMatch = t.match(/(?:u|na|adresa|ulica|grad)\s+([a-zšđčćž0-9\s]+?)(?:,\s*|\s+(?:sutra|danas|u\s+\d|broj|telefon|tel|cena|rok|$))/i);
  if (lokMatch && lokMatch[1]) {
    const moguca = lokMatch[1].trim();
    if (moguca.length > 2 && !['toku', 'radu', 'poslu', 'nabavci', 'prodavnici', 'redu'].includes(moguca)) {
      rez.lokacija = moguca.charAt(0).toUpperCase() + moguca.slice(1);
    }
  }

  // 4. DETEKCIJA DATUMA I TERMINA
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

  // -------------------------------------------------------------
  // TAB 2: NABAVKA (Lista namirnica / artikala za prodavnicu)
  // -------------------------------------------------------------
  if (tipKonteksta === 'nabavka') {
    rez.naslov = `Lista za nabavku (${new Date().toLocaleDateString('sr-RS')})`;
    const artikli: StavkaSpecifikacije[] = [];

    // Delimo unos po zarezima, tačkama, novim redovima ili veznicima "i", "zatim", "plus"
    const delovi = tekst.split(/[,;\n]|\s+i\s+|\s+zatim\s+|\s+plus\s+/i);

    delovi.forEach((deo, idx) => {
      let cist = deo.trim();
      // Očisti prefikse tipa "kupi", "treba", "uzmi", "nabavi", "spisak"
      cist = cist.replace(/^(?:treba(?:\s+mi)?|kupi(?:\s+mi)?|uzmi|nabavi|spisak(?:\s+za)?|namirnice)\s+/i, '').trim();
      if (!cist || cist.length < 2) return;

      // Pokušaj izdvajanja cene na kraju ako postoji (npr "kafa 200gr 350 dinara")
      let procenaCena = 0;
      let valuta: 'RSD' | 'EUR' = 'RSD';
      const cenaMatch = cist.match(/\s+(\d+(?:[.,]\d+)?)\s*(din|rsd|eur|evr|evra|€)$/i);
      if (cenaMatch) {
        procenaCena = parseFloat(cenaMatch[1].replace(',', '.'));
        if (['eur', 'evr', 'evra', '€'].some(e => cenaMatch[2].toLowerCase().includes(e))) {
          valuta = 'EUR';
        }
        cist = cist.replace(cenaMatch[0], '').trim();
      }

      // Regex za prepoznavanje:
      // A) Količina na početku: npr. "2 kg jabuka", "500 gr kave", "3 komada hleba", "2 glavice luka"
      const kolStartMatch = cist.match(/^(\d+(?:[.,]\d+)?)\s*(kg|kila|kilogram|kilograma|g|gr|grama|gram|l|litra|litar|litara|ml|kom|komada|komad|pak|paket|pakovanje|pakovanja|kutija|kutije|džak|dzak|džaka|dzaka|džakova|dzakova|kanta|kante|kanti|m|metar|metara|flaša|flasa|flase|flaše|glavica|glavice|veza|veze)?\s+(.+)$/i);

      // B) Količina na kraju: npr. "Jabuke 2kg", "Banane 1 kg", "Kafa 200gr", "Beli luk 2 glavice", "Paprika 3 kom"
      const kolEndMatch = cist.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(kg|kila|kilogram|kilograma|g|gr|grama|gram|l|litra|litar|litara|ml|kom|komada|komad|pak|paket|pakovanje|pakovanja|kutija|kutije|džak|dzak|džaka|dzaka|džakova|dzakova|kanta|kante|kanti|m|metar|metara|flaša|flasa|flase|flaše|glavica|glavice|veza|veze)?$/i);

      if (kolEndMatch && kolEndMatch[1].length > 1) {
        const artikal = kolEndMatch[1].trim();
        const broj = kolEndMatch[2].replace(',', '.');
        const jedinica = normalizujJedinicuMere(kolEndMatch[3] || 'kom');
        artikli.push({
          id: `item_${Date.now()}_${idx}`,
          br: artikli.length + 1,
          opis: artikal.charAt(0).toUpperCase() + artikal.slice(1),
          kolicina: `${broj} ${jedinica}`.trim(),
          jed_mere: jedinica,
          jed_cena: procenaCena > 0 ? procenaCena : undefined,
          iznos: procenaCena,
          valuta,
          kupljeno: false
        });
      } else if (kolStartMatch && kolStartMatch[3].length > 1) {
        const broj = kolStartMatch[1].replace(',', '.');
        const jedinica = normalizujJedinicuMere(kolStartMatch[2] || 'kom');
        const artikal = kolStartMatch[3].trim();
        artikli.push({
          id: `item_${Date.now()}_${idx}`,
          br: artikli.length + 1,
          opis: artikal.charAt(0).toUpperCase() + artikal.slice(1),
          kolicina: `${broj} ${jedinica}`.trim(),
          jed_mere: jedinica,
          jed_cena: procenaCena > 0 ? procenaCena : undefined,
          iznos: procenaCena,
          valuta,
          kupljeno: false
        });
      } else {
        // Ako nema eksplicitne količine, upisujemo kao "1 kom"
        artikli.push({
          id: `item_${Date.now()}_${idx}`,
          br: artikli.length + 1,
          opis: cist.charAt(0).toUpperCase() + cist.slice(1),
          kolicina: '1 kom',
          jed_mere: 'kom',
          jed_cena: procenaCena > 0 ? procenaCena : undefined,
          iznos: procenaCena,
          valuta,
          kupljeno: false
        });
      }
    });

    if (artikli.length > 0) {
      rez.stavke = artikli;
      rez.opis_zadatka = `Lista: ${artikli.map(a => `${a.opis} (${a.kolicina})`).slice(0, 4).join(', ')}${artikli.length > 4 ? '...' : ''}`;
      rez.iznos = artikli.reduce((sum, a) => sum + (a.iznos || 0), 0);
    }
    return rez;
  }

  // -------------------------------------------------------------
  // TAB 1: POSAO (Specifikacija građevinskog materijala i radova)
  // -------------------------------------------------------------
  if (tipKonteksta === 'posao') {
    const linije = tekst.split(/[,;\n]|\s+i\s+/i);
    const stavkePosla: StavkaSpecifikacije[] = [];
    let ukupnoBezPdv = 0;
    let glavnaValuta: 'RSD' | 'EUR' = 'RSD';

    linije.forEach((lin, idx) => {
      let l = lin.trim();
      if (!l || l.length < 2) return;

      // Pokušaj izdvajanja naslova specifikacije iz prve linije ako nema cenu
      if (idx === 0 && !/\d+\s*(?:din|rsd|eur|evr|po)/i.test(l) && linije.length > 1) {
        rez.naslov = l.charAt(0).toUpperCase() + l.slice(1);
        return;
      }

      // Detekcija šablona: "Podna keramička pločica 120 kvadrata po 2800 dinara"
      // ili "lepak za pločice 1200 kg po 95 dinara"
      // ili "fug masa 150 kg 320 dinara"
      const stavkaRegex = /^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(m2|m²|kvadrat|kvadrata|kv|kg|kila|kilogram|kilograma|kom|komada|komad|pak|pakovanje|pakovanja|m|metar|metara|l|litar|litara|džak|dzak|džaka|dzaka|džakova|dzakova)?\s+(?:po\s+)?(\d+(?:[.,]\d+)?)\s*(din|rsd|eur|evr|evra|evro|€)?$/i;

      const m = l.match(stavkaRegex);
      if (m) {
        const opis = m[1].replace(/^(?:kupi|nabavi|stavka|rad)\s+/i, '').trim();
        const kolicinaBr = parseFloat(m[2].replace(',', '.'));
        const jedMere = normalizujJedinicuMere(m[3] || 'kom');
        let jedCena = parseFloat(m[4].replace(',', '.'));
        const valJed = (m[5] || '').toLowerCase();
        let stavkaValuta: 'RSD' | 'EUR' = 'RSD';

        if (['eur', 'evr', 'evra', 'evro', '€'].some(v => valJed.includes(v))) {
          stavkaValuta = 'EUR';
          glavnaValuta = 'EUR';
        }

        const stavkaUkupno = Math.round(kolicinaBr * jedCena);
        stavkePosla.push({
          id: `posao_${Date.now()}_${idx}`,
          br: stavkePosla.length + 1,
          opis: opis.charAt(0).toUpperCase() + opis.slice(1),
          jed_mere: jedMere,
          kolicina: kolicinaBr,
          jed_cena: jedCena,
          iznos: stavkaUkupno,
          valuta: stavkaValuta
        });
        ukupnoBezPdv += stavkaUkupno;
      } else {
        // Alternativni šablon: "Gips 3000 din" ili "rad 100 evra"
        const jednostavanMatch = l.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(din|rsd|eur|evr|evra|evro|€|hiljad|soma|som)?$/i);
        if (jednostavanMatch) {
          const opis = jednostavanMatch[1].replace(/^(?:kupi|nabavi|stavka|rad)\s+/i, '').trim();
          let cena = parseFloat(jednostavanMatch[2].replace(',', '.'));
          const valJed = (jednostavanMatch[3] || '').toLowerCase();
          let stavkaValuta: 'RSD' | 'EUR' = 'RSD';

          if (['eur', 'evr', 'evra', 'evro', '€'].some(v => valJed.includes(v))) {
            stavkaValuta = 'EUR';
            glavnaValuta = 'EUR';
          } else if (valJed.includes('som') || valJed.includes('hiljad')) {
            cena *= 1000;
          }

          stavkePosla.push({
            id: `posao_${Date.now()}_${idx}`,
            br: stavkePosla.length + 1,
            opis: opis.charAt(0).toUpperCase() + opis.slice(1),
            jed_mere: 'kom',
            kolicina: 1,
            jed_cena: cena,
            iznos: cena,
            valuta: stavkaValuta
          });
          ukupnoBezPdv += cena;
        }
      }
    });

    if (stavkePosla.length > 0) {
      rez.stavke = stavkePosla;
      rez.iznos = ukupnoBezPdv;
      rez.valuta = glavnaValuta;
      rez.pdv_iznos = Math.round(ukupnoBezPdv * 0.20);
      rez.ukupno_sa_pdv = ukupnoBezPdv + rez.pdv_iznos;
      if (!rez.naslov) {
        rez.naslov = rez.klijent_ime ? `Posao - ${rez.klijent_ime}` : `Specifikacija materijala (${stavkePosla.length} stavki)`;
      }
    } else {
      // Ako nije prepoznata specifikacija stavki po stavku, pokušaj jedinstveni iznos
      const cifraMatch = t.match(/(\d+(?:[.,]\d+)?)\s*(?:eur|evr|evra|evro|€|din|rsd)/i);
      if (cifraMatch) {
        const val = parseFloat(cifraMatch[1].replace(',', '.'));
        rez.iznos = val;
        rez.valuta = /eur|evr|evra|evro|€/i.test(cifraMatch[0]) ? 'EUR' : 'RSD';
        rez.pdv_iznos = Math.round(val * 0.20);
        rez.ukupno_sa_pdv = val + rez.pdv_iznos;
      }
      if (!rez.naslov) {
        rez.naslov = rez.klijent_ime ? `Posao - ${rez.klijent_ime}` : 'Građevinski posao';
      }
    }

    if (t.includes('kapar') || t.includes('avans') || t.includes('uzeo')) {
      rez.je_kapara = true;
    }

    return rez;
  }

  // -------------------------------------------------------------
  // TAB 3: ZAKAZANI POSLOVI (Radni nalozi, klijent, adresa, termin)
  // -------------------------------------------------------------
  if (tipKonteksta === 'zakazano') {
    rez.naslov = rez.klijent_ime ? `Termin: ${rez.klijent_ime}` : 'Zakazan radni nalog';
    // Čistimo opis zadatka od imena i telefona ako su već izdvojeni
    let cistOpis = tekst;
    if (rez.klijent_telefon) cistOpis = cistOpis.replace(rez.klijent_telefon, '');
    if (rez.klijent_ime) cistOpis = cistOpis.replace(new RegExp(rez.klijent_ime, 'gi'), '');
    cistOpis = cistOpis.replace(/^(?:zakazi|zakazano|termin|posao|rad)\s+/i, '').trim();
    rez.opis_zadatka = cistOpis || 'Zakazan posao kod klijenta';
    return rez;
  }

  return rez;
}
