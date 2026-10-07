function parsirajTekst(tekst) {
  const rez = {
    klijent_ime: '',
    lokacija: '',
    iznos: 0,
    valuta: 'RSD',
    je_kapara: false,
    rok_datum: null,
    opis_zadatka: tekst.trim()
  };

  const t = tekst.toLowerCase();

  // 1. Klijent
  const klijentMatch = t.match(/(?:kod|za)\s+(?:majstora\s+)?([a-zšđčćž]+)/i);
  if (klijentMatch && klijentMatch[1]) {
    const ime = klijentMatch[1];
    if (!['mene', 'njega', 'nas', 'vas'].includes(ime.toLowerCase())) {
      rez.klijent_ime = ime.charAt(0).toUpperCase() + ime.slice(1);
    }
  }

  // 2. Lokacija
  const lokacijaMatch = t.match(/(?:na|u)\s+([a-zšđčćž]+(?:u|i|om|em))/i);
  if (lokacijaMatch && lokacijaMatch[1]) {
    const lok = lokacijaMatch[1];
    if (!['ponedeljak', 'utorak', 'sredu', 'četvrtak', 'petak', 'subotu', 'nedelju'].includes(lok.toLowerCase())) {
      rez.lokacija = lok.charAt(0).toUpperCase() + lok.slice(1);
    }
  }

  // 3. Kapara
  if (t.includes('kapar')) {
    rez.je_kapara = true;
  }

  // 4. Novac
  const eurMatch = t.match(/(\d+(?:[.,]\d+)?)\s*(?:evra|eura|eur|evrića|evri|e)/i);
  if (eurMatch) {
    rez.iznos = parseFloat(eurMatch[1].replace(',', '.'));
    rez.valuta = 'EUR';
  } else {
    const somMatch = t.match(/(\d+)\s*(?:soma|som|crvene|crvenih|hiljada|hiljade)/i);
    if (somMatch) {
      rez.iznos = parseInt(somMatch[1], 10) * 1000;
      rez.valuta = 'RSD';
    } else {
      const dinMatch = t.match(/(\d+)\s*(?:dinara|din)/i);
      if (dinMatch) {
        rez.iznos = parseInt(dinMatch[1], 10);
        rez.valuta = 'RSD';
      }
    }
  }

  // 5. Dani i vreme
  if (t.includes('sutra')) {
    rez.rok_datum = 'Sutra';
  } else if (t.includes('ponedeljak')) {
    rez.rok_datum = 'Ponedeljak';
  }

  // 6. Zadatak
  const zadatakRegex = /(?:treba da|moram da|dužan sam|zadatak|kupiti|doneti)\s+([^.]+)/i;
  const zadatakMatch = t.match(zadatakRegex);
  if (zadatakMatch && zadatakMatch[1]) {
    rez.opis_zadatka = zadatakMatch[1].trim();
  }

  return rez;
}

const primeri = [
  "Danas kod Zorana na Vračaru uzeo 4 soma, treba da donesem slavinu sutra",
  "Kod Milana na Novom Beogradu uzeo 50 evra kapare za bojler, montaža u ponedeljak",
  "Za Dragana zamenjen ventil, naplaćeno 2500 dinara"
];

primeri.forEach((primer, idx) => {
  console.log(`\nTest ${idx + 1}: "${primer}"`);
  console.log(JSON.stringify(parsirajTekst(primer), null, 2));
});
