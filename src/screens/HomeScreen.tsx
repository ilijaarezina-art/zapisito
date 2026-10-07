import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
  useWindowDimensions
} from 'react-native';
import { StorageService, LokalniPodsetnik, KorisnikCache, LicencaCache } from '../services/storage';
import { SyncService, DEFAULT_API_URL } from '../services/sync';
import { parsirajTekst, ParsiraniPodsetnik } from '../services/parser';
import { PdfService } from '../services/pdfService';
import VoiceWaveform from '../components/VoiceWaveform';
import NabavkaView from '../components/NabavkaView';
import KalendarView from '../components/KalendarView';

interface HomeScreenProps {
  korisnik: KorisnikCache;
  onOdjava: () => void;
  onOtvoriAdmin: () => void;
}

export default function HomeScreen({ korisnik, onOdjava, onOtvoriAdmin }: HomeScreenProps) {
  const { width: sirinaEkrana } = useWindowDimensions();
  const jeDesktopTablet = sirinaEkrana >= 640;

  const [podsetnici, setPodsetnici] = useState<LokalniPodsetnik[]>([]);
  const [licenca, setLicenca] = useState<LicencaCache | null>(null);
  const [preostaloSati72, setPreostaloSati72] = useState<number>(72);
  const [sinhronizuje, setSinhronizuje] = useState(false);

  // Modal za unos/govor i snimanje mikrofonom
  const [modalOtvoren, setModalOtvoren] = useState(false);
  const [izgovoreniTekst, setIzgovoreniTekst] = useState('');
  const [parsirano, setParsirano] = useState<ParsiraniPodsetnik | null>(null);
  const [jeSnimanjeAktivno, setJeSnimanjeAktivno] = useState(false);
  const [speechPodrzan, setSpeechPodrzan] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'aktivni' | 'zavrseni'>('aktivni');
  const [glavniPrikaz, setGlavniPrikaz] = useState<'poslovi' | 'nabavka' | 'kalendar'>('poslovi');
  const [pretragaTekst, setPretragaTekst] = useState('');
  const [aktivniChipFilter, setAktivniChipFilter] = useState<'svi' | 'danas' | 'kapara' | 'materijal'>('svi');
  const recognitionRef = useRef<any>(null);

  // Modal za naknadnu izmenu / doradu unosa posla
  const [editUnosOtvoren, setEditUnosOtvoren] = useState(false);
  const [izabraniPodsetnikZaEdit, setIzabraniPodsetnikZaEdit] = useState<LokalniPodsetnik | null>(null);
  const [editImeKlijenta, setEditImeKlijenta] = useState('');
  const [editTelefonKlijenta, setEditTelefonKlijenta] = useState('');
  const [editLokacija, setEditLokacija] = useState('');
  const [editIznos, setEditIznos] = useState('');
  const [editValuta, setEditValuta] = useState<'RSD' | 'EUR'>('RSD');
  const [editJeKapara, setEditJeKapara] = useState(false);
  const [editOpis, setEditOpis] = useState('');
  const [editCuva, setEditCuva] = useState(false);

  // Diktiranje po pojedinačnom polju unutar modala za izmenu
  const [snimaPolje, setSnimaPolje] = useState<'ime' | 'telefon' | 'lokacija' | 'iznos' | 'opis' | null>(null);
  const editRecognitionRef = useRef<any>(null);

  // Modal za izmenu profila
  const [editProfilOtvoren, setEditProfilOtvoren] = useState(false);
  const [profilIme, setProfilIme] = useState(korisnik.ime || '');
  const [profilEmail, setProfilEmail] = useState('');
  const [profilTelefon, setProfilTelefon] = useState('');
  const [novaLozinka, setNovaLozinka] = useState('');
  const [prikaziNovuLozinku, setPrikaziNovuLozinku] = useState(false);
  const [cuvaProfil, setCuvaProfil] = useState(false);

  const ucitajPodatke = async () => {
    const lista = await StorageService.getSviPodsetnici();
    setPodsetnici(lista);

    const lic = await StorageService.getLicenca();
    setLicenca(lic);

    const status72 = await StorageService.proveriStatus72h();
    setPreostaloSati72(status72.preostaloSati);
  };

  const sacuvajIzmeneProfila = async () => {
    // Provera Emaila
    if (profilEmail.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(profilEmail.trim())) {
        Alert.alert('Neispravan Email', 'Unesite ispravnu email adresu (npr. petar@gmail.com).');
        return;
      }
    }
    // Provera Telefona
    if (profilTelefon.trim()) {
      const ciscen = profilTelefon.trim().replace(/[\s\-\/]/g, '');
      const telRegex = /^(\+3810?6|06)\d{6,8}$/;
      if (!telRegex.test(ciscen)) {
        Alert.alert(
          'Neispravan broj telefona',
          'Broj telefona mora počinjati sa 06 ili +38106 i sadržati 9 do 13 cifara.'
        );
        return;
      }
    }
    // Provera lozinke ako je uneta
    if (novaLozinka.trim() && novaLozinka.trim().length < 6) {
      Alert.alert('Prekratka lozinka', 'Nova lozinka mora imati najmanje 6 karaktera.');
      return;
    }

    setCuvaProfil(true);
    try {
      const isPhp = DEFAULT_API_URL.includes('.php');
      const url = isPhp ? `${DEFAULT_API_URL}?action=update_profile` : `${DEFAULT_API_URL}/auth/update-profile`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${korisnik.token}`
        },
        body: JSON.stringify({
          korisnik_id: korisnik.id,
          ime: profilIme.trim() || null,
          email: profilEmail.trim() || null,
          broj_telefona: profilTelefon.trim() || null,
          nova_lozinka: novaLozinka.trim() || undefined
        })
      });

      const data = await res.json();
      if (res.ok) {
        Alert.alert('Uspešno!', 'Podaci vašeg profila su uspešno sačuvani.');
        setEditProfilOtvoren(false);
        setNovaLozinka('');
        const azuriran: KorisnikCache = {
          ...korisnik,
          ime: profilIme.trim() || null
        };
        await StorageService.sacuvajKorisnika(azuriran);
      } else {
        Alert.alert('Greška', data.message || data.poruka || 'Nije uspelo čuvanje.');
      }
    } catch (err) {
      Alert.alert('Greška', 'Došlo je do greške u komunikaciji sa serverom.');
    } finally {
      setCuvaProfil(false);
    }
  };

  const obrisiSopstveniNalog = () => {
    if (korisnik.id === 1) {
      Alert.alert('Zaštićen nalog', 'Glavni Super Administrator (ilija) se ne može obrisati.');
      return;
    }

    // Za Web koristimo window.confirm ili standardni Alert
    if (Platform.OS === 'web') {
      const potvrdjeno = window.confirm(
        `⚠️ TRAJNO BRISANJE NALOGA\n\nDa li ste sigurni da želite da trajno obrišete nalog "${korisnik.korisnicko_ime}"?\n\nSvi vaši poslovi, unosi i pretplata biće trajno izbrisani iz baze!`
      );
      if (potvrdjeno) {
        izvrsiBrisanjeNaloga();
      }
    } else {
      Alert.alert(
        '⚠️ Trajno brisanje naloga',
        `Da li ste sigurni da želite da trajno obrišete nalog "${korisnik.korisnicko_ime}"?\n\nSvi vaši poslovi i podaci biće trajno obrisani iz baze!`,
        [
          { text: 'Odustani', style: 'cancel' },
          { text: 'OBRIŠI NALOG', style: 'destructive', onPress: izvrsiBrisanjeNaloga }
        ]
      );
    }
  };

  const izvrsiBrisanjeNaloga = async () => {
    try {
      const isPhp = DEFAULT_API_URL.includes('.php');
      const url = isPhp ? `${DEFAULT_API_URL}?action=delete_account` : `${DEFAULT_API_URL}/auth/delete-account`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${korisnik.token}`
        },
        body: JSON.stringify({ korisnik_id: korisnik.id })
      });

      const data = await res.json();
      if (res.ok) {
        Alert.alert('Obrisano', 'Vaš nalog je trajno obrisan iz baze.');
        await StorageService.obrisiKorisnika();
        onOdjava();
      } else {
        Alert.alert('Greška', data.message || data.poruka);
      }
    } catch (err) {
      Alert.alert('Greška', 'Došlo je do greške pri brisanju naloga.');
    }
  };

  useEffect(() => {
    ucitajPodatke();
    // Pokušaj tihe sinhronizacije na startu ako ima neta
    SyncService.izvrsiSinhronizaciju().then(() => ucitajPodatke());

    if (Platform.OS === 'web') {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
      setSpeechPodrzan(!!SpeechRecognition);
    }
  }, []);

  const pokreniSnimanje = () => {
    if (Platform.OS === 'web') {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      if (!SpeechRecognition) {
        Alert.alert(
          'Prepoznavanje govora (Firefox)',
          'Pretraživač Firefox po defaultu nema omogućen Web Speech API.\n\n' +
          '⭐ Za najbolje iskustvo diktiranja na srpskom otvorite aplikaciju u Google Chrome ili Microsoft Edge gde radi fabrički.\n\n' +
          '💡 Na Windows-u možete pritisnuti prečicu [Win + H] za trenutno besplatno diktiranje glasom direktno u polje!'
        );
        return;
      }

      try {
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
          } catch (e) {}
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'sr-RS';
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onstart = () => {
          setJeSnimanjeAktivno(true);
        };

        recognition.onresult = (event: any) => {
          let transkript = '';
          for (let i = 0; i < event.results.length; i++) {
            transkript += event.results[i][0].transcript;
          }
          if (transkript.trim()) {
            rukujIzmenomTeksta(transkript);
          }
        };

        recognition.onerror = (event: any) => {
          console.warn('Mikrofon greška:', event.error);
          setJeSnimanjeAktivno(false);
          if (event.error === 'not-allowed') {
            Alert.alert(
              'Dozvola za mikrofon',
              'Molimo vas da odobrite pristup mikrofonu u pretraživaču (ikona mikrofona u adresnoj traci).'
            );
          }
        };

        recognition.onend = () => {
          setJeSnimanjeAktivno(false);
        };

        recognition.start();
        recognitionRef.current = recognition;
        setJeSnimanjeAktivno(true);
      } catch (err) {
        console.error('Nije uspelo pokretanje mikrofona:', err);
        setJeSnimanjeAktivno(false);
      }
    } else {
      // Mobilni uređaji
      setJeSnimanjeAktivno(true);
    }
  };

  const zaustaviSnimanje = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
    }
    setJeSnimanjeAktivno(false);
  };

  const otvoriModalZaGovor = () => {
    setModalOtvoren(true);
    // Automatski pokreni mikrofon
    setTimeout(() => {
      pokreniSnimanje();
    }, 250);
  };

  const zatvoriModal = () => {
    zaustaviSnimanje();
    setModalOtvoren(false);
  };

  const pokreniRucnuSinhronizaciju = async () => {
    setSinhronizuje(true);
    const rez = await SyncService.izvrsiSinhronizaciju();
    setSinhronizuje(false);
    await ucitajPodatke();
    Alert.alert('Sinhronizacija', rez.poruka);
  };

  // Kada korisnik unese/izgovori tekst, odmah ga u hodu parsiramo
  const rukujIzmenomTeksta = (tekst: string) => {
    setIzgovoreniTekst(tekst);
    if (tekst.trim().length > 3) {
      const rez = parsirajTekst(tekst);
      setParsirano(rez);
    } else {
      setParsirano(null);
    }
  };

  // 1-klik čuvanje
  const sacuvajNoviPodsetnik = async () => {
    if (!parsirano) return;

    try {
      await StorageService.sacuvajPodsetnik({
        sirovi_tekst: izgovoreniTekst,
        klijent_ime: parsirano.klijent_ime,
        klijent_telefon: parsirano.klijent_telefon,
        lokacija: parsirano.lokacija,
        iznos: parsirano.iznos,
        valuta: parsirano.valuta,
        je_kapara: parsirano.je_kapara,
        rok_datum: parsirano.rok_datum,
        opis_zadatka: parsirano.opis_zadatka,
        stavke: parsirano.stavke,
        je_zavrseno: false
      });

      zaustaviSnimanje();
      setModalOtvoren(false);
      setIzgovoreniTekst('');
      setParsirano(null);
      await ucitajPodatke();

      // Pozadinska sinhronizacija ako ima mreže
      SyncService.izvrsiSinhronizaciju().then(() => ucitajPodatke());
    } catch (err: any) {
      Alert.alert('Ograničenje', err.message);
    }
  };

  const prebaciZavrseno = async (uuid: string, trenutno: boolean) => {
    await StorageService.azurirajPodsetnik(uuid, { je_zavrseno: !trenutno });
    await ucitajPodatke();
  };

  const zaustaviSnimanjePolja = () => {
    if (editRecognitionRef.current) {
      try {
        editRecognitionRef.current.stop();
      } catch (e) {}
      editRecognitionRef.current = null;
    }
    setSnimaPolje(null);
  };

  const toggleSnimanjePolja = (polje: 'ime' | 'telefon' | 'lokacija' | 'iznos' | 'opis') => {
    if (snimaPolje === polje) {
      zaustaviSnimanjePolja();
      return;
    }

    zaustaviSnimanjePolja();

    // Zaustavi i glavno snimanje ako slučajno radi
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
      setJeSnimanjeAktivno(false);
    }

    if (Platform.OS === 'web') {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      if (!SpeechRecognition) {
        Alert.alert(
          'Prepoznavanje govora (Firefox)',
          'Pretraživač Firefox po defaultu nema omogućen Web Speech API.\n\n' +
          '⭐ Za najbolje iskustvo diktiranja na srpskom otvorite aplikaciju u Google Chrome ili Microsoft Edge gde radi fabrički.\n\n' +
          '💡 Na Windows-u možete pritisnuti prečicu [Win + H] za trenutno diktiranje glasom direktno u polje!'
        );
        return;
      }

      try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'sr-RS';
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onstart = () => {
          setSnimaPolje(polje);
        };

        recognition.onresult = (event: any) => {
          let transkript = '';
          for (let i = 0; i < event.results.length; i++) {
            transkript += event.results[i][0].transcript;
          }
          const cistTekst = transkript.trim();
          if (!cistTekst) return;

          if (polje === 'ime') {
            const formatirano = cistTekst.charAt(0).toUpperCase() + cistTekst.slice(1);
            setEditImeKlijenta(formatirano);
          } else if (polje === 'telefon') {
            // Pretvaranje izgovorenih reči brojeva u numeričke cifre
            const reci: Record<string, string> = {
              nula: '0', jedan: '1', dva: '2', tri: '3', četiri: '4', cetiri: '4',
              pet: '5', šest: '6', sest: '6', sedam: '7', osam: '8', devet: '9', plus: '+'
            };
            let pretvoreno = cistTekst.toLowerCase();
            Object.keys(reci).forEach(r => {
              const regex = new RegExp(`\\b${r}\\b`, 'g');
              pretvoreno = pretvoreno.replace(regex, reci[r]);
            });
            const cifre = pretvoreno.replace(/[^\d+]/g, '');
            setEditTelefonKlijenta(cifre || cistTekst);
          } else if (polje === 'lokacija') {
            const formatirano = cistTekst.charAt(0).toUpperCase() + cistTekst.slice(1);
            setEditLokacija(formatirano);
          } else if (polje === 'iznos') {
            if (/evr|eur|euro/i.test(cistTekst)) {
              setEditValuta('EUR');
            } else if (/din|rsd/i.test(cistTekst)) {
              setEditValuta('RSD');
            }
            const matchBroj = cistTekst.match(/\d+([.,]\d+)?/);
            if (matchBroj) {
              setEditIznos(matchBroj[0]);
            } else {
              setEditIznos(cistTekst);
            }
          } else if (polje === 'opis') {
            setEditOpis(cistTekst);
          }
        };

        recognition.onerror = (event: any) => {
          console.warn('Mikrofon greška u polju:', event.error);
          setSnimaPolje(null);
          if (event.error === 'not-allowed') {
            Alert.alert(
              'Dozvola za mikrofon',
              'Molimo vas da odobrite pristup mikrofonu u pretraživaču.'
            );
          }
        };

        recognition.onend = () => {
          setSnimaPolje(null);
        };

        recognition.start();
        editRecognitionRef.current = recognition;
        setSnimaPolje(polje);
      } catch (err) {
        console.error('Nije uspelo pokretanje mikrofona za polje:', err);
        setSnimaPolje(null);
      }
    } else {
      setSnimaPolje(polje);
    }
  };

  const otvoriModalZaIzmenu = (item: LokalniPodsetnik) => {
    zaustaviSnimanjePolja();
    setIzabraniPodsetnikZaEdit(item);
    setEditImeKlijenta(item.klijent_ime || '');
    setEditTelefonKlijenta(item.klijent_telefon || '');
    setEditLokacija(item.lokacija || '');
    setEditIznos(item.iznos > 0 ? String(item.iznos) : '');
    setEditValuta(item.valuta || 'RSD');
    setEditJeKapara(item.je_kapara || false);
    setEditOpis(item.opis_zadatka || '');
    setEditUnosOtvoren(true);
  };

  const sacuvajIzmeneUnosa = async () => {
    if (!izabraniPodsetnikZaEdit) return;

    zaustaviSnimanjePolja();
    setEditCuva(true);
    try {
      const noviIznos = parseFloat(editIznos.replace(',', '.')) || 0;
      await StorageService.azurirajPodsetnik(izabraniPodsetnikZaEdit.uuid_lokalni, {
        klijent_ime: editImeKlijenta.trim(),
        klijent_telefon: editTelefonKlijenta.trim() || null,
        lokacija: editLokacija.trim(),
        iznos: noviIznos,
        valuta: editValuta,
        je_kapara: editJeKapara,
        opis_zadatka: editOpis.trim()
      });

      setEditUnosOtvoren(false);
      setIzabraniPodsetnikZaEdit(null);
      await ucitajPodatke();

      // Tiha sinhronizacija sa serverom
      SyncService.izvrsiSinhronizaciju().then(() => ucitajPodatke());
      Alert.alert('Uspešno', 'Izmene posla su uspešno sačuvane!');
    } catch (err: any) {
      Alert.alert('Greška', 'Nije uspelo čuvanje izmena.');
    } finally {
      setEditCuva(false);
    }
  };

  const obrisiOdredjeniPodsetnik = (item: LokalniPodsetnik) => {
    const naziv = item.klijent_ime ? `posao za klijenta "${item.klijent_ime}"` : 'ovaj posao';

    const izvrsiBrisanje = async () => {
      await StorageService.obrisiPodsetnik(item.uuid_lokalni);
      await ucitajPodatke();

      // Obriši i na serveru ako ima interneta
      try {
        const isPhp = DEFAULT_API_URL.includes('.php');
        const url = isPhp ? `${DEFAULT_API_URL}?action=delete_podsetnik` : `${DEFAULT_API_URL}/podsetnici/delete`;
        fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${korisnik.token}`
          },
          body: JSON.stringify({
            uuid_lokalni: item.uuid_lokalni,
            korisnik_id: korisnik.id
          })
        }).catch(() => {});
      } catch (e) {}
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Da li ste sigurni da želite da trajno obrišete ${naziv}?`)) {
        izvrsiBrisanje();
      }
    } else {
      Alert.alert(
        'Brisanje posla',
        `Da li ste sigurni da želite da trajno obrišete ${naziv}?`,
        [
          { text: 'Odustani', style: 'cancel' },
          { text: 'Obriši', style: 'destructive', onPress: izvrsiBrisanje }
        ]
      );
    }
  };

  const posaljiPorukuKlijentu = (item: LokalniPodsetnik) => {
    const datumTekst = item.rok_datum ? new Date(item.rok_datum).toLocaleDateString('sr-RS') : 'uskoro';

    let tekstPoruke = `Pozdrav${item.klijent_ime ? ' ' + item.klijent_ime : ''},\n`;

    if (item.stavke && item.stavke.length > 0) {
      tekstPoruke += `Zabeležena je specifikacija za radove:\n📋 Specifikacija:\n`;
      item.stavke.forEach(s => {
        tekstPoruke += `• ${s.opis}: ${s.iznos.toLocaleString('sr-RS')} ${s.valuta}\n`;
      });
      tekstPoruke += `------------------------\n`;
      tekstPoruke += `💰 Ukupno: ${item.iznos.toLocaleString('sr-RS')} ${item.valuta}\n`;
    } else {
      tekstPoruke += `Zabeležili smo posao: ${item.opis_zadatka}.\n`;
      if (item.iznos > 0) {
        tekstPoruke += `Iznos: ${item.iznos.toLocaleString('sr-RS')} ${item.valuta}.\n`;
      }
    }

    tekstPoruke += `Rok: ${datumTekst}.`;
    const poruka = encodeURIComponent(tekstPoruke);

    // Ako imamo zabeležen broj telefona klijenta, šaljemo DIREKTNO na njegov broj
    if (item.klijent_telefon) {
      let tel = item.klijent_telefon.replace(/[\s\-\/]/g, '');
      if (tel.startsWith('+')) {
        tel = tel.slice(1);
      }
      if (tel.startsWith('06')) {
        tel = '381' + tel.slice(1);
      }

      const waUrl = `https://wa.me/${tel}?text=${poruka}`;
      const smsUrl = `sms:${item.klijent_telefon}?body=${poruka}`;

      Linking.openURL(waUrl).catch(() => {
        Linking.openURL(smsUrl);
      });
    } else {
      // Ako nema broja, otvara WhatsApp izbornik kontakata
      Linking.openURL(`whatsapp://send?text=${poruka}`).catch(() => {
        Linking.openURL(`sms:?body=${poruka}`);
      });
    }
  };

  const otvoriNavigaciju = (lokacija: string) => {
    if (!lokacija || !lokacija.trim()) {
      Alert.alert('Lokacija', 'Za ovaj posao nije uneta adresa/lokacija.');
      return;
    }
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lokacija.trim())}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Navigacija', 'Nije uspelo otvaranje mapa.');
    });
  };

  const uzmiStatusBoju = (item: LokalniPodsetnik) => {
    if (item.je_zavrseno) return '#10B981';
    if (item.je_kapara) return '#F59E0B';
    if (item.rok_datum) {
      const d = new Date(item.rok_datum).setHours(0, 0, 0, 0);
      const dDanas = new Date().setHours(0, 0, 0, 0);
      if (d <= dDanas) return '#EF4444';
      return '#3B82F6';
    }
    return '#10B981';
  };

  // Filtriranje poslova: aktivni i završeni
  const aktivniPoslovi = podsetnici.filter(p => !p.je_zavrseno);
  const zavrseniPoslovi = podsetnici.filter(p => p.je_zavrseno);

  const danasPocetak = new Date();
  danasPocetak.setHours(0, 0, 0, 0);
  const danasKraj = new Date();
  danasKraj.setHours(23, 59, 59, 999);

  const posloviDanasBroj = aktivniPoslovi.filter(p => {
    if (!p.rok_datum) return false;
    const d = new Date(p.rok_datum);
    return d <= danasKraj;
  }).length;

  const brojStavkiZaNabavku = aktivniPoslovi.reduce(
    (cnt, p) => cnt + (p.stavke ? p.stavke.length : 0),
    0
  );

  const posloviZaTab = filterStatus === 'aktivni' ? aktivniPoslovi : zavrseniPoslovi;

  const filtriraniPoslovi = posloviZaTab.filter(p => {
    // Filter chip
    if (aktivniChipFilter === 'danas') {
      if (!p.rok_datum) return false;
      const d = new Date(p.rok_datum);
      if (d > danasKraj) return false;
    } else if (aktivniChipFilter === 'kapara') {
      if (!p.je_kapara) return false;
    } else if (aktivniChipFilter === 'materijal') {
      if (!p.stavke || p.stavke.length === 0) return false;
    }

    // Pretraga tekst
    if (pretragaTekst.trim()) {
      const q = pretragaTekst.toLowerCase().trim();
      const uImenu = p.klijent_ime && p.klijent_ime.toLowerCase().includes(q);
      const uOpisu = p.opis_zadatka && p.opis_zadatka.toLowerCase().includes(q);
      const uLokaciji = p.lokacija && p.lokacija.toLowerCase().includes(q);
      const uTel = p.klijent_telefon && p.klijent_telefon.includes(q);
      const uStavkama = p.stavke && p.stavke.some(s => s.opis.toLowerCase().includes(q));
      return uImenu || uOpisu || uLokaciji || uTel || uStavkama;
    }

    return true;
  });

  return (
    <View style={styles.container}>
      {/* Gornji bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.logoTekst}>🎙️ ZapišiTo</Text>
          <View style={styles.korisnikRow}>
            <Text style={styles.korisnikLabel}>
              Korisnik: <Text style={{ color: '#fff', fontWeight: 'bold' }}>{korisnik.korisnicko_ime}</Text>
            </Text>
            {/* Olovka za izmenu podataka */}
            <TouchableOpacity
              style={styles.btnIkonaEdit}
              onPress={() => setEditProfilOtvoren(true)}
              accessibilityLabel="Izmena profila"
            >
              <Text style={{ fontSize: 13 }}>✏️</Text>
            </TouchableOpacity>

            {/* Crvena kanta za trajno brisanje naloga */}
            <TouchableOpacity
              style={styles.btnIkonaKanta}
              onPress={obrisiSopstveniNalog}
              accessibilityLabel="Obriši nalog"
            >
              <Text style={{ fontSize: 13 }}>🗑️</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.topDugmad}>
          {korisnik.role_id === 1 && (
            <TouchableOpacity style={styles.btnAdmin} onPress={onOtvoriAdmin}>
              <Text style={styles.btnAdminTekst}>👑 Admin</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.btnOdjava} onPress={onOdjava}>
            <Text style={styles.btnOdjavaTekst}>Izlaz</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 72h Offline i status licence */}
      <View style={styles.bannerContainer}>
        <View style={styles.bannerRow}>
          <Text style={styles.bannerTekst}>
            ⏱️ Offline limit: <Text style={{ fontWeight: 'bold' }}>{preostaloSati72}h preostalo</Text>
          </Text>
          <TouchableOpacity
            style={styles.btnSync}
            onPress={pokreniRucnuSinhronizaciju}
            disabled={sinhronizuje}
          >
            {sinhronizuje ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.btnSyncTekst}>🔄 Sinhronizuj</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.licencaTekst}>
          {licenca?.token_active === 1
            ? `🟢 Pretplata aktivna (važi do: ${licenca.token_expires_at ? new Date(licenca.token_expires_at).toLocaleDateString('sr-RS') : 'Trajno'})`
            : `🟡 Besplatni unosi: ${licenca?.besplatni_unosi_iskorisceno || 0}/10 iskorišćeno`}
        </Text>
      </View>

      {/* GLAVNI MENI: POSLOVI / ZA NABAVKU / KALENDAR */}
      <View style={styles.glavniMeniKontejner}>
        <TouchableOpacity
          style={[styles.glavniMeniTab, glavniPrikaz === 'poslovi' && styles.glavniMeniTabAktivno]}
          onPress={() => setGlavniPrikaz('poslovi')}
          activeOpacity={0.7}
        >
          <Text style={[styles.glavniMeniTekst, glavniPrikaz === 'poslovi' && styles.glavniMeniTekstAktivno]}>
            📋 Poslovi ({aktivniPoslovi.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.glavniMeniTab, glavniPrikaz === 'nabavka' && styles.glavniMeniTabAktivno]}
          onPress={() => setGlavniPrikaz('nabavka')}
          activeOpacity={0.7}
        >
          <Text style={[styles.glavniMeniTekst, glavniPrikaz === 'nabavka' && styles.glavniMeniTekstAktivno]}>
            🛒 Za nabavku
          </Text>
          {brojStavkiZaNabavku > 0 && (
            <View style={styles.badgeBroj}>
              <Text style={styles.badgeBrojTekst}>{brojStavkiZaNabavku}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.glavniMeniTab, glavniPrikaz === 'kalendar' && styles.glavniMeniTabAktivno]}
          onPress={() => setGlavniPrikaz('kalendar')}
          activeOpacity={0.7}
        >
          <Text style={[styles.glavniMeniTekst, glavniPrikaz === 'kalendar' && styles.glavniMeniTekstAktivno]}>
            📅 Kalendar
          </Text>
        </TouchableOpacity>
      </View>

      {/* PRIKAZ 1: ZA NABAVKU */}
      {glavniPrikaz === 'nabavka' && (
        <NabavkaView podsetnici={podsetnici} />
      )}

      {/* PRIKAZ 2: KALENDAR RASPORED */}
      {glavniPrikaz === 'kalendar' && (
        <KalendarView
          podsetnici={podsetnici}
          onIzaberiPosao={otvoriModalZaIzmenu}
          onZavrsiPosao={prebaciZavrseno}
        />
      )}

      {/* PRIKAZ 3: LISTA POSLOVA */}
      {glavniPrikaz === 'poslovi' && (
        <View style={{ flex: 1 }}>
          {/* Pametni podsetnik: poslovi zakazani za danas */}
          {posloviDanasBroj > 0 && (
            <View style={styles.podsetnikDanasKutija}>
              <View style={{ flex: 1 }}>
                <Text style={styles.podsetnikDanasNaslov}>
                  ⏰ Danas imate {posloviDanasBroj === 1 ? '1 zakazan posao' : `${posloviDanasBroj} zakazana posla`}!
                </Text>
                <Text style={styles.podsetnikDanasPod}>
                  Pogledajte termine za danas ili otvorite Kalendar.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.podsetnikDanasDugme}
                onPress={() => {
                  setFilterStatus('aktivni');
                  setAktivniChipFilter('danas');
                }}
              >
                <Text style={styles.podsetnikDanasDugmeTekst}>Prikaži →</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Pretraga i brzi filter čipovi */}
          <View style={styles.pretragaKontejner}>
            <View style={styles.pretragaInputRed}>
              <Text style={styles.pretragaIkona}>🔍</Text>
              <TextInput
                style={styles.pretragaInput}
                placeholder="Pretraži klijenta, posao, lokaciju, materijal..."
                placeholderTextColor="#71717A"
                value={pretragaTekst}
                onChangeText={setPretragaTekst}
              />
              {pretragaTekst.length > 0 && (
                <TouchableOpacity onPress={() => setPretragaTekst('')}>
                  <Text style={styles.pretragaObrisi}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterChipsScroll}
            >
              <TouchableOpacity
                style={[styles.chipFilter, aktivniChipFilter === 'svi' && styles.chipFilterAktivno]}
                onPress={() => setAktivniChipFilter('svi')}
              >
                <Text style={[styles.chipFilterTekst, aktivniChipFilter === 'svi' && styles.chipFilterTekstAktivno]}>
                  Svi ({posloviZaTab.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.chipFilter, aktivniChipFilter === 'danas' && styles.chipFilterAktivno]}
                onPress={() => setAktivniChipFilter('danas')}
              >
                <Text style={[styles.chipFilterTekst, aktivniChipFilter === 'danas' && styles.chipFilterTekstAktivno]}>
                  🔴 Danas ({posloviDanasBroj})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.chipFilter, aktivniChipFilter === 'kapara' && styles.chipFilterAktivno]}
                onPress={() => setAktivniChipFilter('kapara')}
              >
                <Text style={[styles.chipFilterTekst, aktivniChipFilter === 'kapara' && styles.chipFilterTekstAktivno]}>
                  🟡 Sa kaparom
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.chipFilter, aktivniChipFilter === 'materijal' && styles.chipFilterAktivno]}
                onPress={() => setAktivniChipFilter('materijal')}
              >
                <Text style={[styles.chipFilterTekst, aktivniChipFilter === 'materijal' && styles.chipFilterTekstAktivno]}>
                  📋 Sa specifikacijom
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Traka za izbor Aktivni / Završeni */}
          <View style={styles.posloviBarContainer}>
            <View style={styles.posloviInfo}>
              <Text style={styles.posloviNaslov}>
                {filterStatus === 'aktivni' ? '⚡ Aktivni poslovi' : '✅ Završeni poslovi (Arhiva)'}
              </Text>
              <Text style={styles.posloviPodnaslov}>
                Prikazano: {filtriraniPoslovi.length} od {posloviZaTab.length}
              </Text>
            </View>

            <View style={styles.taboviKontejner}>
              <TouchableOpacity
                style={[styles.tabDugme, filterStatus === 'aktivni' && styles.tabDugmeAktivno]}
                onPress={() => setFilterStatus('aktivni')}
              >
                <Text style={[styles.tabDugmeTekst, filterStatus === 'aktivni' && styles.tabDugmeTekstAktivno]}>
                  Aktivni ({aktivniPoslovi.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabDugme, filterStatus === 'zavrseni' && styles.tabDugmeAktivno]}
                onPress={() => setFilterStatus('zavrseni')}
              >
                <Text style={[styles.tabDugmeTekst, filterStatus === 'zavrseni' && styles.tabDugmeTekstAktivno]}>
                  Završeni ({zavrseniPoslovi.length})
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Lista poslova */}
          <FlatList
            data={filtriraniPoslovi}
            keyExtractor={item => item.uuid_lokalni}
            contentContainerStyle={{ padding: 16, paddingBottom: 120, width: '100%', maxWidth: 760, alignSelf: 'center' }}
            ListEmptyComponent={
              filterStatus === 'aktivni' ? (
                <View style={styles.prazno}>
                  <Text style={styles.praznoIkona}>🎉</Text>
                  <Text style={styles.praznoTekst}>
                    {pretragaTekst || aktivniChipFilter !== 'svi'
                      ? 'Nema poslova koji odgovaraju izabranoj pretrazi/filteru.'
                      : 'Nemate aktivnih poslova. Pritisnite dugme "ZAPIŠI TO" ispod da zabeležite novi posao.'}
                  </Text>
                </View>
              ) : (
                <View style={styles.prazno}>
                  <Text style={styles.praznoIkona}>📁</Text>
                  <Text style={styles.praznoTekst}>Nema završenih poslova u arhivi.</Text>
                </View>
              )
            }
            renderItem={({ item }) => {
              const statusBoja = uzmiStatusBoju(item);

              return (
                <View
                  style={[
                    styles.kartica,
                    { borderLeftColor: statusBoja, borderLeftWidth: 4 },
                    item.je_zavrseno && styles.karticaZavrseno
                  ]}
                >
                  <View style={styles.karticaHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.karticaKlijent}>
                        👤 {item.klijent_ime || 'Nepoznat klijent'}
                      </Text>

                      {/* Čip za lokaciju sa 1-klik navigacijom na Google Maps */}
                      {item.lokacija ? (
                        <TouchableOpacity
                          style={styles.chipLokacija}
                          onPress={() => otvoriNavigaciju(item.lokacija)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.chipLokacijaTekst}>📍 {item.lokacija} (Otvori mapu 🗺️)</Text>
                        </TouchableOpacity>
                      ) : null}

                      {item.klijent_telefon ? (
                        <Text style={styles.karticaTelefon}>📞 {item.klijent_telefon}</Text>
                      ) : null}

                      <Text style={styles.karticaZadatak}>{item.opis_zadatka}</Text>
                    </View>

                    {item.iznos > 0 && (
                      <View style={styles.iznosBadge}>
                        <Text style={styles.iznosTekst}>
                          {item.iznos.toLocaleString('sr-RS')} {item.valuta}
                        </Text>
                        {item.je_kapara && <Text style={styles.kaparaTekst}>KAPARA</Text>}
                      </View>
                    )}
                  </View>

                  {/* Prikaz specifikacije stavki ako postoje */}
                  {item.stavke && item.stavke.length > 0 && (
                    <View style={styles.karticaSpecifikacija}>
                      <Text style={styles.karticaSpecifikacijaNaslov}>📋 Specifikacija stavki ({item.stavke.length}):</Text>
                      {item.stavke.map((st, i) => (
                        <View key={i} style={styles.karticaSpecifikacijaRed}>
                          <Text style={styles.karticaSpecifikacijaStavka}>• {st.opis}</Text>
                          <Text style={styles.karticaSpecifikacijaCena}>
                            {st.iznos.toLocaleString('sr-RS')} {st.valuta}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {item.rok_datum && (
                    <Text style={styles.rokTekst}>
                      📅 Rok: {new Date(item.rok_datum).toLocaleString('sr-RS', { dateStyle: 'short', timeStyle: 'short' })}
                    </Text>
                  )}

                  {/* Akciona dugmad: WhatsApp poruka + 1-klik PDF Predračun */}
                  <View style={styles.akcijeDvaReda}>
                    <TouchableOpacity
                      style={[styles.btnPoruka, { flex: 1.1 }]}
                      onPress={() => posaljiPorukuKlijentu(item)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.btnPorukaTekst} numberOfLines={1}>
                        💬 WhatsApp / Poruka
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.btnPdfPredracun, { flex: 1 }]}
                      onPress={() => PdfService.otvoriIliPodeliPdf(item, korisnik)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.btnPdfPredracunTekst} numberOfLines={1}>
                        📄 PDF Predračun
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.karticaFooter}>
                    <TouchableOpacity
                      style={[styles.btnZavrsi, item.je_zavrseno && styles.btnZavrsiAktivno]}
                      onPress={() => prebaciZavrseno(item.uuid_lokalni, item.je_zavrseno)}
                    >
                      <Text style={styles.btnZavrsiTekst}>
                        {item.je_zavrseno ? '↩️ Vrati u aktivne' : '⭕ Označi kao gotovo'}
                      </Text>
                    </TouchableOpacity>

                    {/* Dugme za naknadnu izmenu posla */}
                    <TouchableOpacity
                      style={styles.btnAkcijaPosao}
                      onPress={() => otvoriModalZaIzmenu(item)}
                      accessibilityLabel="Izmeni unos"
                    >
                      <Text style={{ fontSize: 13 }}>✏️</Text>
                    </TouchableOpacity>

                    {/* Dugme za brisanje unosa */}
                    <TouchableOpacity
                      style={[styles.btnAkcijaPosao, styles.btnKantaPosao]}
                      onPress={() => obrisiOdredjeniPodsetnik(item)}
                      accessibilityLabel="Obriši unos"
                    >
                      <Text style={{ fontSize: 13 }}>🗑️</Text>
                    </TouchableOpacity>

                    <Text style={styles.syncStatus}>
                      {item.is_synced ? '☁️ Sačuvano' : '💾 Na tel.'}
                    </Text>
                  </View>
                </View>
              );
            }}
          />
        </View>
      )}

      {/* Glavno OGROMNO dugme: ZAPIŠI TO */}
      <View style={styles.floatingButtonContainer}>
        <TouchableOpacity
          style={styles.btnGlavnoGlas}
          onPress={otvoriModalZaGovor}
          activeOpacity={0.85}
        >
          <Text style={styles.btnGlavnoGlasIkona}>🎙️</Text>
          <Text style={styles.btnGlavnoGlasTekst}>ZAPIŠI TO (GOVOR)</Text>
        </TouchableOpacity>
      </View>

      {/* Modal za brzi govor i pregled */}
      {modalOtvoren && (
        <View style={[StyleSheet.absoluteFill, styles.modalOverlay, jeDesktopTablet && styles.modalOverlayDesktop, { zIndex: 9999 }]}>
          <View style={[styles.modalSadrzaj, jeDesktopTablet && styles.modalSadrzajDesktop]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalNaslov}>🎙️ Snimanje / Unos beleške</Text>
              <TouchableOpacity onPress={zatvoriModal}>
                <Text style={styles.modalZatvori}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Kontrola mikrofona i dugme za završetak snimanja */}
            <View style={[styles.mikrofonStatusKutija, jeSnimanjeAktivno && styles.mikrofonStatusKutijaAktivno]}>
              {jeSnimanjeAktivno ? (
                <View style={styles.snimanjeRed}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={styles.snimanjeTekstGlavni}>🔴 SNIMANJE U TOKU...</Text>
                    <Text style={styles.snimanjeTekstPod}>Slušam vaš govor na srpskom jeziku</Text>
                  </View>
                  <VoiceWaveform aktivan={true} boja="#10B981" />
                  <TouchableOpacity
                    style={styles.btnZavrsiSnimanje}
                    onPress={zaustaviSnimanje}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.btnZavrsiSnimanjeTekst}>⏹️ ZAVRŠI</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.snimanjeRed}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={styles.snimanjeTekstSpreman}>Mikrofon zaustavljen</Text>
                    <Text style={styles.snimanjeTekstPod}>Pritisnite dugme za ponovni govor</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.btnPokreniSnimanje}
                    onPress={pokreniSnimanje}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.btnPokreniSnimanjeTekst}>🎙️ POKRENI MIKROFON</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Firefox savet ako nema Web Speech API */}
            {Platform.OS === 'web' && !speechPodrzan && (
              <View style={styles.firefoxKutija}>
                <Text style={styles.firefoxNaslov}>💡 Pretraživač Firefox nema fabrički Web Speech API:</Text>
                <Text style={styles.firefoxTekst}>
                  • Za direktan mikrofon otvorite u <Text style={{ color: '#60A5FA', fontWeight: 'bold' }}>Google Chrome</Text> ili <Text style={{ color: '#60A5FA', fontWeight: 'bold' }}>Microsoft Edge</Text>.
                </Text>
                <Text style={styles.firefoxTekst}>
                  • Ili na tastaturi pritisnite prečicu <Text style={{ color: '#34D399', fontWeight: 'bold' }}>Win + H</Text> za besplatno diktiranje glasom na Windows-u!
                </Text>
              </View>
            )}

            <TextInput
              style={styles.modalInput}
              multiline
              placeholder="npr. Danas kod Zorana na Vračaru uzeo 4 soma, treba da donesem slavinu sutra u 10"
              placeholderTextColor="#71717A"
              value={izgovoreniTekst}
              onChangeText={rukujIzmenomTeksta}
              autoFocus
            />

            {/* Brzi tasteri za simulaciju realnog govora majstora */}
            <Text style={styles.brziPrimeriNaslov}>Isprobajte brzi primer jednim klikom:</Text>
            <View style={styles.primeriContainer}>
              <TouchableOpacity
                style={styles.chipPrimer}
                onPress={() => rukujIzmenomTeksta('Kod Zorana 0641234567 na Vračaru\ngvoždje 10 kg oko 3000 din\ncement 20 džakova 20000 dinara\nšljunak 4 kubika 8000 dinara')}
              >
                <Text style={styles.chipPrimerTekst}>"📋 Specifikacija: gvoždje, cement, šljunak..."</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.chipPrimer}
                onPress={() => rukujIzmenomTeksta('Danas kod Zorana 0641234567 na Vračaru zamenjen ventil, uzeo 4 soma za ruke')}
              >
                <Text style={styles.chipPrimerTekst}>"Kod Zorana 064... uzeo 4 soma"</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.chipPrimer}
                onPress={() => rukujIzmenomTeksta('Kod Milana uzeo 50 evra kapare za bojler, montaža u ponedeljak')}
              >
                <Text style={styles.chipPrimerTekst}>"Kod Milana 50€ kapara ponedeljak"</Text>
              </TouchableOpacity>
            </View>

            {/* Kartica prepoznatih polja (Opcija B u realnom vremenu) */}
            {parsirano && (
              <View style={styles.pregledKartica}>
                <Text style={styles.pregledNaslov}>⚡ Automatski prepoznato (0ms):</Text>
                <Text style={styles.pregledStavka}>
                  👤 Klijent: <Text style={{ color: '#fff', fontWeight: 'bold' }}>{parsirano.klijent_ime || 'Nije prepoznato'}</Text>
                  {parsirano.lokacija ? ` (${parsirano.lokacija})` : ''}
                </Text>

                {parsirano.klijent_telefon ? (
                  <Text style={styles.pregledStavka}>
                    📞 Telefon klijenta: <Text style={{ color: '#FDE047', fontWeight: 'bold' }}>{parsirano.klijent_telefon}</Text>
                  </Text>
                ) : null}

                {/* Ako postoji višestruka specifikacija stavki */}
                {parsirano.stavke && parsirano.stavke.length > 0 ? (
                  <View style={styles.pregledSpecifikacija}>
                    <Text style={styles.pregledSpecifikacijaNaslov}>📋 Automatska specifikacija ({parsirano.stavke.length} stavke):</Text>
                    {parsirano.stavke.map((st, i) => (
                      <View key={i} style={styles.pregledSpecifikacijaRed}>
                        <Text style={styles.pregledSpecifikacijaOpis}>• {st.opis}</Text>
                        <Text style={styles.pregledSpecifikacijaCena}>
                          {st.iznos.toLocaleString('sr-RS')} {st.valuta}
                        </Text>
                      </View>
                    ))}
                    <View style={styles.pregledSpecifikacijaZbirRed}>
                      <Text style={styles.pregledSpecifikacijaZbirLabel}>💰 UKUPAN ZBIR:</Text>
                      <Text style={styles.pregledSpecifikacijaZbirVrednost}>
                        {parsirano.iznos.toLocaleString('sr-RS')} {parsirano.valuta}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.pregledStavka}>
                    💰 Iznos: <Text style={{ color: '#34D399', fontWeight: 'bold' }}>{parsirano.iznos.toLocaleString('sr-RS')} {parsirano.valuta}</Text>
                    {parsirano.je_kapara ? ' (Kapara)' : ''}
                  </Text>
                )}

                {parsirano.rok_datum && (
                  <Text style={styles.pregledStavka}>
                    📅 Datum/Rok: <Text style={{ color: '#60A5FA' }}>{new Date(parsirano.rok_datum).toLocaleString('sr-RS')}</Text>
                  </Text>
                )}
                <Text style={styles.pregledStavka}>
                  📝 Zadatak/Opis: <Text style={{ color: '#fff' }}>{parsirano.opis_zadatka}</Text>
                </Text>

                <TouchableOpacity style={styles.btnSacuvajPotvrda} onPress={sacuvajNoviPodsetnik}>
                  <Text style={styles.btnSacuvajPotvrdaTekst}>✓ POTVRDI I SAČUVAJ</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      )}

      {/* MODAL: IZMENA PODATAKA KORISNIKA */}
      {editProfilOtvoren && (
        <View style={[StyleSheet.absoluteFill, styles.modalOverlay, jeDesktopTablet && styles.modalOverlayDesktop, { zIndex: 9999 }]}>
          <View style={[styles.modalSadrzaj, jeDesktopTablet && styles.modalSadrzajDesktop]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalNaslov}>✏️ Izmena podataka profila</Text>
              <TouchableOpacity onPress={() => setEditProfilOtvoren(false)}>
                <Text style={styles.modalZatvori}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.profilLabel}>Ime i prezime</Text>
            <TextInput
              style={styles.profilInput}
              placeholder="Vaše ime"
              placeholderTextColor="#71717A"
              value={profilIme}
              onChangeText={setProfilIme}
            />

            <Text style={styles.profilLabel}>Email adresa</Text>
            <TextInput
              style={styles.profilInput}
              placeholder="npr. petar@gmail.com"
              placeholderTextColor="#71717A"
              keyboardType="email-address"
              autoCapitalize="none"
              value={profilEmail}
              onChangeText={setProfilEmail}
            />

            <Text style={styles.profilLabel}>Broj telefona (06... ili +38106...)</Text>
            <TextInput
              style={styles.profilInput}
              placeholder="npr. 0641234567 ili +3810641234567"
              placeholderTextColor="#71717A"
              keyboardType="phone-pad"
              value={profilTelefon}
              onChangeText={setProfilTelefon}
            />

            <Text style={styles.profilLabel}>Nova lozinka (ostavite prazno ako ne menjate)</Text>
            <View style={styles.lozinkaKontejner}>
              <TextInput
                style={styles.lozinkaInput}
                placeholder="Minimalno 6 karaktera"
                placeholderTextColor="#71717A"
                secureTextEntry={!prikaziNovuLozinku}
                value={novaLozinka}
                onChangeText={setNovaLozinka}
              />
              <TouchableOpacity
                style={styles.btnOko}
                onPress={() => setPrikaziNovuLozinku(!prikaziNovuLozinku)}
              >
                <Text style={styles.btnOkoTekst}>{prikaziNovuLozinku ? '👁️' : '🙈'}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.btnSacuvajProfil}
              onPress={sacuvajIzmeneProfila}
              disabled={cuvaProfil}
            >
              {cuvaProfil ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnSacuvajProfilTekst}>✓ SAČUVAJ IZMENE</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* MODAL: NAKNADNA IZMENA I DORADA UNOSA POSLA */}
      {editUnosOtvoren && (
        <View style={[StyleSheet.absoluteFill, styles.modalOverlay, jeDesktopTablet && styles.modalOverlayDesktop, { zIndex: 9999 }]}>
          <View style={[styles.modalSadrzaj, jeDesktopTablet && styles.modalSadrzajDesktop]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalNaslov}>✏️ Izmena / Dorada posla</Text>
              <TouchableOpacity onPress={() => { zaustaviSnimanjePolja(); setEditUnosOtvoren(false); }}>
                <Text style={styles.modalZatvori}>✕</Text>
              </TouchableOpacity>
            </View>

            {snimaPolje !== null && (
              <View style={styles.snimaPoljeIndicator}>
                <Text style={styles.snimaPoljeIndicatorTekst}>
                  🔴 Slušam govor za polje: <Text style={{ fontWeight: 'bold' }}>{snimaPolje.toUpperCase()}</Text>
                </Text>
                <VoiceWaveform aktivan={true} boja="#EF4444" />
              </View>
            )}

            <ScrollView contentContainerStyle={{ paddingBottom: 25 }}>
              {/* Ime klijenta */}
              <Text style={styles.profilLabel}>Ime klijenta / mušterije</Text>
              <View style={styles.poljeSaMikrofonomRed}>
                <TextInput
                  style={[styles.profilInput, styles.inputFlex, snimaPolje === 'ime' && styles.inputSnimaAktivno]}
                  placeholder="npr. Zoran, Milan..."
                  placeholderTextColor="#71717A"
                  value={editImeKlijenta}
                  onChangeText={setEditImeKlijenta}
                />
                <TouchableOpacity
                  style={[styles.btnMikrofonPolje, snimaPolje === 'ime' && styles.btnMikrofonPoljeAktivno]}
                  onPress={() => toggleSnimanjePolja('ime')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.btnMikrofonPoljeIkona}>{snimaPolje === 'ime' ? '⏹️' : '🎙️'}</Text>
                  <Text style={[styles.btnMikrofonPoljeTekst, snimaPolje === 'ime' && styles.btnMikrofonPoljeTekstAktivno]}>
                    {snimaPolje === 'ime' ? 'Snima...' : 'Glas'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Broj telefona */}
              <Text style={styles.profilLabel}>Broj telefona klijenta</Text>
              <View style={styles.poljeSaMikrofonomRed}>
                <TextInput
                  style={[styles.profilInput, styles.inputFlex, snimaPolje === 'telefon' && styles.inputSnimaAktivno]}
                  placeholder="npr. 0641234567"
                  placeholderTextColor="#71717A"
                  keyboardType="phone-pad"
                  value={editTelefonKlijenta}
                  onChangeText={setEditTelefonKlijenta}
                />
                <TouchableOpacity
                  style={[styles.btnMikrofonPolje, snimaPolje === 'telefon' && styles.btnMikrofonPoljeAktivno]}
                  onPress={() => toggleSnimanjePolja('telefon')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.btnMikrofonPoljeIkona}>{snimaPolje === 'telefon' ? '⏹️' : '🎙️'}</Text>
                  <Text style={[styles.btnMikrofonPoljeTekst, snimaPolje === 'telefon' && styles.btnMikrofonPoljeTekstAktivno]}>
                    {snimaPolje === 'telefon' ? 'Snima...' : 'Glas'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Lokacija */}
              <Text style={styles.profilLabel}>Lokacija / Mesto rada</Text>
              <View style={styles.poljeSaMikrofonomRed}>
                <TextInput
                  style={[styles.profilInput, styles.inputFlex, snimaPolje === 'lokacija' && styles.inputSnimaAktivno]}
                  placeholder="npr. Vračar, Novi Beograd..."
                  placeholderTextColor="#71717A"
                  value={editLokacija}
                  onChangeText={setEditLokacija}
                />
                <TouchableOpacity
                  style={[styles.btnMikrofonPolje, snimaPolje === 'lokacija' && styles.btnMikrofonPoljeAktivno]}
                  onPress={() => toggleSnimanjePolja('lokacija')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.btnMikrofonPoljeIkona}>{snimaPolje === 'lokacija' ? '⏹️' : '🎙️'}</Text>
                  <Text style={[styles.btnMikrofonPoljeTekst, snimaPolje === 'lokacija' && styles.btnMikrofonPoljeTekstAktivno]}>
                    {snimaPolje === 'lokacija' ? 'Snima...' : 'Glas'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Iznos cene rada */}
              <Text style={styles.profilLabel}>Iznos cene / rada</Text>
              <View style={styles.poljeSaMikrofonomRed}>
                <TextInput
                  style={[styles.profilInput, styles.inputFlex, snimaPolje === 'iznos' && styles.inputSnimaAktivno]}
                  placeholder="npr. 4000 ili 50"
                  placeholderTextColor="#71717A"
                  keyboardType="numeric"
                  value={editIznos}
                  onChangeText={setEditIznos}
                />
                <TouchableOpacity
                  style={[styles.btnMikrofonPolje, snimaPolje === 'iznos' && styles.btnMikrofonPoljeAktivno]}
                  onPress={() => toggleSnimanjePolja('iznos')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.btnMikrofonPoljeIkona}>{snimaPolje === 'iznos' ? '⏹️' : '🎙️'}</Text>
                  <Text style={[styles.btnMikrofonPoljeTekst, snimaPolje === 'iznos' && styles.btnMikrofonPoljeTekstAktivno]}>
                    {snimaPolje === 'iznos' ? 'Snima...' : 'Glas'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Izbor valute (RSD i EUR - 100% vidljivi na svim ekranima) */}
              <Text style={styles.profilLabel}>Valuta naplate</Text>
              <View style={styles.valutaIzborRed}>
                <TouchableOpacity
                  style={[styles.valutaVelikoDugme, editValuta === 'RSD' && styles.valutaVelikoDugmeAktivno]}
                  onPress={() => setEditValuta('RSD')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.valutaZastavica}>🇷🇸</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.valutaVelikiNaslov, editValuta === 'RSD' && styles.valutaVelikiNaslovAktivno]}>
                      RSD (Dinar)
                    </Text>
                  </View>
                  {editValuta === 'RSD' ? (
                    <Text style={styles.valutaCekirano}>✓ Izabrano</Text>
                  ) : null}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.valutaVelikoDugme, editValuta === 'EUR' && styles.valutaVelikoDugmeAktivno]}
                  onPress={() => setEditValuta('EUR')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.valutaZastavica}>🇪🇺</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.valutaVelikiNaslov, editValuta === 'EUR' && styles.valutaVelikiNaslovAktivno]}>
                      EUR (€ Evro)
                    </Text>
                  </View>
                  {editValuta === 'EUR' ? (
                    <Text style={styles.valutaCekirano}>✓ Izabrano</Text>
                  ) : null}
                </TouchableOpacity>
              </View>

              {/* Kapara opcija */}
              <TouchableOpacity
                style={styles.kaparaToggleRow}
                onPress={() => setEditJeKapara(!editJeKapara)}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 18 }}>{editJeKapara ? '☑️' : '⬜'}</Text>
                <Text style={styles.kaparaToggleTekst}>Ovaj iznos je kapara (akontacija)</Text>
              </TouchableOpacity>

              {/* Opis posla */}
              <Text style={styles.profilLabel}>Opis radova / zadatka</Text>
              <View style={styles.poljeSaMikrofonomRed}>
                <TextInput
                  style={[
                    styles.profilInput,
                    styles.inputFlex,
                    { minHeight: 80, textAlignVertical: 'top' },
                    snimaPolje === 'opis' && styles.inputSnimaAktivno
                  ]}
                  multiline
                  placeholder="npr. Zamena ventila, doneti slavinu..."
                  placeholderTextColor="#71717A"
                  value={editOpis}
                  onChangeText={setEditOpis}
                />
                <TouchableOpacity
                  style={[
                    styles.btnMikrofonPolje,
                    { height: 80, justifyContent: 'center' },
                    snimaPolje === 'opis' && styles.btnMikrofonPoljeAktivno
                  ]}
                  onPress={() => toggleSnimanjePolja('opis')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.btnMikrofonPoljeIkona}>{snimaPolje === 'opis' ? '⏹️' : '🎙️'}</Text>
                  <Text style={[styles.btnMikrofonPoljeTekst, snimaPolje === 'opis' && styles.btnMikrofonPoljeTekstAktivno]}>
                    {snimaPolje === 'opis' ? 'Snima...' : 'Glas'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Dugmad na dnu: Odustani i Sačuvaj */}
              <View style={styles.modalDugmadRed}>
                <TouchableOpacity
                  style={styles.btnModalOdustani}
                  onPress={() => { zaustaviSnimanjePolja(); setEditUnosOtvoren(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.btnModalOdustaniTekst}>Odustani</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btnSacuvajProfil, { flex: 1, marginTop: 0 }]}
                  onPress={sacuvajIzmeneUnosa}
                  disabled={editCuva}
                  activeOpacity={0.8}
                >
                  {editCuva ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.btnSacuvajProfilTekst}>✓ SAČUVAJ IZMENE</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#101014' },
  topBar: {
    paddingTop: 45,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#18181E',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#262633'
  },
  logoTekst: { fontSize: 24, fontWeight: '900', color: '#10B981' },
  korisnikLabel: { fontSize: 12, color: '#A1A1AA', marginTop: 2 },
  topDugmad: { flexDirection: 'row', gap: 8 },
  btnAdmin: { backgroundColor: '#F59E0B', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  btnAdminTekst: { color: '#000', fontWeight: '800', fontSize: 12 },
  btnOdjava: { backgroundColor: '#272730', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  btnOdjavaTekst: { color: '#E4E4E7', fontSize: 12 },
  bannerContainer: { backgroundColor: '#1E1E28', padding: 12, borderBottomWidth: 1, borderColor: '#2A2A3A' },
  bannerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bannerTekst: { color: '#FCD34D', fontSize: 13 },
  btnSync: { backgroundColor: '#2563EB', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  btnSyncTekst: { color: '#fff', fontSize: 12, fontWeight: '700' },
  licencaTekst: { color: '#A1A1AA', fontSize: 11, marginTop: 4 },
  posloviBarContainer: {
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#181822',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2D2D3D'
  },
  posloviInfo: {
    flex: 1
  },
  posloviNaslov: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800'
  },
  posloviPodnaslov: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2
  },
  taboviKontejner: {
    flexDirection: 'row',
    backgroundColor: '#272733',
    borderRadius: 10,
    padding: 3
  },
  tabDugme: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8
  },
  tabDugmeAktivno: {
    backgroundColor: '#10B981'
  },
  tabDugmeTekst: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '700'
  },
  tabDugmeTekstAktivno: {
    color: '#FFFFFF',
    fontWeight: '900'
  },
  prazno: { alignItems: 'center', marginTop: 40, paddingHorizontal: 20 },
  praznoIkona: { fontSize: 42, marginBottom: 8 },
  praznoTekst: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  praznoPodtekst: { color: '#A1A1AA', fontSize: 14, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  demoKutija: {
    backgroundColor: '#181822',
    padding: 16,
    borderRadius: 14,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#2F2F40',
    width: '100%'
  },
  demoKutijaNaslov: { color: '#25D366', fontSize: 14, fontWeight: '800', marginBottom: 6 },
  demoKutijaTekst: { color: '#D4D4D8', fontSize: 13, lineHeight: 19, marginTop: 4 },
  kartica: {
    backgroundColor: '#1A1A22',
    padding: 16,
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#2D2D3D'
  },
  karticaZavrseno: { opacity: 0.55 },
  karticaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  karticaKlijent: { fontSize: 16, fontWeight: '800', color: '#10B981' },
  karticaZadatak: { fontSize: 14, color: '#F4F4F5', marginTop: 4, lineHeight: 20 },
  iznosBadge: { backgroundColor: '#065F46', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, alignItems: 'center' },
  iznosTekst: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
  kaparaTekst: { color: '#FDE047', fontSize: 9, fontWeight: '900' },
  rokTekst: { color: '#60A5FA', fontSize: 13, marginTop: 10, fontWeight: '600' },
  btnPoruka: {
    backgroundColor: '#25D366',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnPorukaTekst: { color: '#000000', fontSize: 13, fontWeight: '800' },
  karticaFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 },
  btnZavrsi: { backgroundColor: '#272733', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  btnZavrsiAktivno: { backgroundColor: '#065F46' },
  btnZavrsiTekst: { color: '#E4E4E7', fontSize: 12, fontWeight: '600' },
  syncStatus: { marginLeft: 'auto', fontSize: 11, color: '#71717A' },
  floatingButtonContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    alignItems: 'center'
  },
  btnGlavnoGlas: {
    backgroundColor: '#10B981',
    width: '100%',
    maxWidth: 560,
    paddingVertical: 18,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    ...Platform.select({
      web: {
        boxShadow: '0px 4px 14px rgba(16, 185, 129, 0.4)'
      },
      default: {
        shadowColor: '#10B981',
        shadowOpacity: 0.4,
        shadowRadius: 10
      }
    })
  },
  btnGlavnoGlasIkona: { fontSize: 24, marginRight: 10 },
  btnGlavnoGlasTekst: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end', alignItems: 'center' },
  modalOverlayDesktop: { justifyContent: 'center', padding: 20 },
  modalSadrzaj: { backgroundColor: '#1C1C24', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%', width: '100%' },
  modalSadrzajDesktop: { maxWidth: 560, borderRadius: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalNaslov: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modalZatvori: { color: '#A1A1AA', fontSize: 20, fontWeight: 'bold' },
  modalInput: {
    backgroundColor: '#272733',
    color: '#fff',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
    borderColor: '#3F3F50',
    borderWidth: 1
  },
  brziPrimeriNaslov: { color: '#71717A', fontSize: 11, marginTop: 12, marginBottom: 6 },
  primeriContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chipPrimer: { backgroundColor: '#2E2E3E', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  chipPrimerTekst: { color: '#93C5FD', fontSize: 11 },
  pregledKartica: { backgroundColor: '#132F24', padding: 14, borderRadius: 12, marginTop: 16, borderWidth: 1, borderColor: '#10B981' },
  pregledNaslov: { color: '#6EE7B7', fontSize: 12, fontWeight: '800', marginBottom: 8 },
  pregledStavka: { color: '#D1D5DB', fontSize: 13, marginBottom: 4 },
  btnSacuvajPotvrda: { backgroundColor: '#10B981', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  btnSacuvajPotvrdaTekst: { color: '#fff', fontSize: 15, fontWeight: '900' },
  korisnikRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4
  },
  btnIkonaEdit: {
    backgroundColor: '#272733',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3F3F50'
  },
  btnIkonaKanta: {
    backgroundColor: '#451A1A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#7F1D1D'
  },
  profilLabel: {
    color: '#D4D4D8',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 10
  },
  profilInput: {
    backgroundColor: '#272733',
    color: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    borderColor: '#3F3F50',
    borderWidth: 1
  },
  lozinkaKontejner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#272733',
    borderRadius: 10,
    borderColor: '#3F3F50',
    borderWidth: 1
  },
  lozinkaInput: {
    flex: 1,
    color: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14
  },
  btnOko: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center'
  },
  btnOkoTekst: {
    fontSize: 16
  },
  btnSacuvajProfil: {
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 18
  },
  btnSacuvajProfilTekst: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800'
  },
  mikrofonStatusKutija: {
    backgroundColor: '#1E1E28',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2F2F40',
    marginBottom: 12
  },
  mikrofonStatusKutijaAktivno: {
    backgroundColor: '#351216',
    borderColor: '#EF4444'
  },
  snimanjeRed: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  snimanjeTekstGlavni: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  snimanjeTekstSpreman: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '700'
  },
  snimanjeTekstPod: {
    color: '#71717A',
    fontSize: 11,
    marginTop: 2
  },
  btnZavrsiSnimanje: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center'
  },
  btnZavrsiSnimanjeTekst: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900'
  },
  btnPokreniSnimanje: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center'
  },
  btnPokreniSnimanjeTekst: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800'
  },
  firefoxKutija: {
    backgroundColor: '#1B1E2E',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3B82F6',
    marginBottom: 12
  },
  firefoxNaslov: {
    color: '#93C5FD',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4
  },
  firefoxTekst: {
    color: '#D1D5DB',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2
  },
  karticaTelefon: {
    color: '#FDE047',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2
  },
  karticaSpecifikacija: {
    backgroundColor: '#14141B',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#2D2D3D'
  },
  karticaSpecifikacijaNaslov: {
    color: '#93C5FD',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4
  },
  karticaSpecifikacijaRed: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2
  },
  karticaSpecifikacijaStavka: {
    color: '#E4E4E7',
    fontSize: 12,
    flex: 1
  },
  karticaSpecifikacijaCena: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '800'
  },
  pregledSpecifikacija: {
    backgroundColor: '#0F291E',
    padding: 10,
    borderRadius: 8,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#059669'
  },
  pregledSpecifikacijaNaslov: {
    color: '#6EE7B7',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6
  },
  pregledSpecifikacijaRed: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2
  },
  pregledSpecifikacijaOpis: {
    color: '#E5E7EB',
    fontSize: 12,
    flex: 1
  },
  pregledSpecifikacijaCena: {
    color: '#A7F3D0',
    fontSize: 12,
    fontWeight: '700'
  },
  pregledSpecifikacijaZbirRed: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderColor: '#059669',
    paddingTop: 6,
    marginTop: 6
  },
  pregledSpecifikacijaZbirLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900'
  },
  pregledSpecifikacijaZbirVrednost: {
    color: '#34D399',
    fontSize: 15,
    fontWeight: '900'
  },
  valutaBtn: {
    backgroundColor: '#272733',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3F3F50'
  },
  valutaBtnAktivno: {
    backgroundColor: '#065F46',
    borderColor: '#10B981'
  },
  valutaBtnTekst: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '700'
  },
  valutaBtnTekstAktivno: {
    color: '#FFFFFF',
    fontWeight: '900'
  },
  kaparaToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10
  },
  kaparaToggleTekst: {
    color: '#D4D4D8',
    fontSize: 13,
    fontWeight: '600'
  },
  btnAkcijaPosao: {
    backgroundColor: '#272733',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#3F3F50'
  },
  btnKantaPosao: {
    backgroundColor: '#451A1A',
    borderColor: '#7F1D1D'
  },
  poljeSaMikrofonomRed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  inputFlex: {
    flex: 1
  },
  inputSnimaAktivno: {
    borderColor: '#EF4444',
    backgroundColor: '#2A1717'
  },
  btnMikrofonPolje: {
    backgroundColor: '#272733',
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3F3F50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5
  },
  btnMikrofonPoljeAktivno: {
    backgroundColor: '#7F1D1D',
    borderColor: '#EF4444'
  },
  btnMikrofonPoljeIkona: {
    fontSize: 15
  },
  btnMikrofonPoljeTekst: {
    color: '#D4D4D8',
    fontSize: 11,
    fontWeight: '700'
  },
  btnMikrofonPoljeTekstAktivno: {
    color: '#FCA5A5'
  },
  valutaIzborRed: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4
  },
  valutaVelikoDugme: {
    flex: 1,
    backgroundColor: '#272733',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#3F3F50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  valutaVelikoDugmeAktivno: {
    backgroundColor: '#064E3B',
    borderColor: '#10B981'
  },
  valutaZastavica: {
    fontSize: 20
  },
  valutaVelikiNaslov: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '700'
  },
  valutaVelikiNaslovAktivno: {
    color: '#FFFFFF',
    fontWeight: '900'
  },
  valutaCekirano: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '900',
    marginLeft: 2
  },
  modalDugmadRed: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    alignItems: 'center'
  },
  btnModalOdustani: {
    backgroundColor: '#272733',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3F3F50',
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnModalOdustaniTekst: {
    color: '#A1A1AA',
    fontSize: 14,
    fontWeight: '700'
  },
  glavniMeniKontejner: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 6,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center'
  },
  glavniMeniTab: {
    flex: 1,
    backgroundColor: '#1E1E28',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2F2F40',
    position: 'relative'
  },
  glavniMeniTabAktivno: {
    backgroundColor: '#0F2E22',
    borderColor: '#10B981'
  },
  glavniMeniTekst: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '700'
  },
  glavniMeniTekstAktivno: {
    color: '#FFFFFF',
    fontWeight: '800'
  },
  badgeBroj: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4
  },
  badgeBrojTekst: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900'
  },
  podsetnikDanasKutija: {
    backgroundColor: '#351216',
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '92%',
    maxWidth: 728,
    alignSelf: 'center'
  },
  podsetnikDanasNaslov: {
    color: '#FCA5A5',
    fontSize: 13,
    fontWeight: '800'
  },
  podsetnikDanasPod: {
    color: '#FECACA',
    fontSize: 11,
    marginTop: 2
  },
  podsetnikDanasDugme: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8
  },
  podsetnikDanasDugmeTekst: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800'
  },
  pretragaKontejner: {
    paddingHorizontal: 16,
    marginTop: 6,
    marginBottom: 6,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center'
  },
  pretragaInputRed: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E28',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#2F2F40'
  },
  pretragaIkona: {
    fontSize: 14,
    marginRight: 8
  },
  pretragaInput: {
    flex: 1,
    color: '#FFFFFF',
    paddingVertical: 10,
    fontSize: 13
  },
  pretragaObrisi: {
    color: '#71717A',
    fontSize: 16,
    padding: 4
  },
  filterChipsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 8
  },
  chipFilter: {
    backgroundColor: '#272736',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#37374A'
  },
  chipFilterAktivno: {
    backgroundColor: '#065F46',
    borderColor: '#10B981'
  },
  chipFilterTekst: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '600'
  },
  chipFilterTekstAktivno: {
    color: '#FFFFFF',
    fontWeight: '800'
  },
  chipLokacija: {
    backgroundColor: '#2A271C',
    borderWidth: 1,
    borderColor: '#854D0E',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginVertical: 4
  },
  chipLokacijaTekst: {
    color: '#FDE047',
    fontSize: 12,
    fontWeight: '700'
  },
  akcijeDvaReda: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12
  },
  btnPdfPredracun: {
    backgroundColor: '#1E3A8A',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#3B82F6'
  },
  btnPdfPredracunTekst: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800'
  },
  snimaPoljeIndicator: {
    backgroundColor: '#2A1717',
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  snimaPoljeIndicatorTekst: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '700'
  }
});
