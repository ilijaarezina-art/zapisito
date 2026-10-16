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
import { VoiceService } from '../services/voiceService';
import VoiceWaveform from '../components/VoiceWaveform';
import NabavkaView from '../components/NabavkaView';
import ZakazaniPosloviView from '../components/ZakazaniPosloviView';
import SpecifikacijaModal from '../components/SpecifikacijaModal';
import NabavkaModal from '../components/NabavkaModal';
import ZakazaniPosaoModal from '../components/ZakazaniPosaoModal';

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
  const [aktivniTipSnimanja, setAktivniTipSnimanja] = useState<'posao' | 'nabavka' | 'zakazano'>('posao');
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
    } else {
      VoiceService.isAvailable().then(avail => setSpeechPodrzan(avail));
    }
  }, []);

  const pokreniSnimanje = async () => {
    setJeSnimanjeAktivno(true);

    const uspeh = await VoiceService.startListening({
      lang: 'sr-RS',
      onStart: () => {
        setJeSnimanjeAktivno(true);
      },
      onResult: (transkript: string) => {
        if (transkript.trim()) {
          rukujIzmenomTeksta(transkript);
        }
      },
      onError: (err: string) => {
        console.warn('VoiceService error:', err);
        setJeSnimanjeAktivno(false);
        if (err.includes('odbijen') || err.includes('not-allowed')) {
          Alert.alert(
            'Dozvola za mikrofon',
            'Molimo odobrite pristup mikrofonu kako biste mogli da diktirate beleške glasom.'
          );
        }
      },
      onEnd: () => {
        setJeSnimanjeAktivno(false);
      }
    });

    if (!uspeh) {
      setJeSnimanjeAktivno(false);
    }
  };

  const zaustaviSnimanje = () => {
    VoiceService.stopListening();
    setJeSnimanjeAktivno(false);
  };

  const otvoriModalZaGovor = (podrazumevaniTip?: 'posao' | 'nabavka' | 'zakazano') => {
    const tip = podrazumevaniTip || (glavniPrikaz === 'nabavka' ? 'nabavka' : (glavniPrikaz === 'kalendar' ? 'zakazano' : 'posao'));
    setAktivniTipSnimanja(tip);
    setIzgovoreniTekst('');
    setParsirano(null);
    setModalOtvoren(true);
    // Automatski pokreni nativni ili web mikrofon
    setTimeout(() => {
      pokreniSnimanje();
    }, 200);
  };

  const zatvoriModal = () => {
    zaustaviSnimanje();
    setModalOtvoren(false);
    setIzgovoreniTekst('');
    setParsirano(null);
  };

  const pokreniRucnuSinhronizaciju = async () => {
    setSinhronizuje(true);
    const rez = await SyncService.izvrsiSinhronizaciju();
    setSinhronizuje(false);
    await ucitajPodatke();
    Alert.alert('Sinhronizacija', rez.poruka);
  };

  // Kada korisnik unese/izgovori tekst, odmah ga u hodu parsiramo u odnosu na izabrani tip dokumenta
  const rukujIzmenomTeksta = (tekst: string) => {
    setIzgovoreniTekst(tekst);
    if (tekst.trim().length > 1) {
      const rez = parsirajTekst(tekst, aktivniTipSnimanja);
      setParsirano(rez);
    } else {
      setParsirano(null);
    }
  };

  // 1-klik čuvanje dokumenta
  const sacuvajNoviPodsetnik = async () => {
    const aktuelnoParsirano = parsirano || parsirajTekst(izgovoreniTekst, aktivniTipSnimanja);
    if (!aktuelnoParsirano) return;

    try {
      await StorageService.sacuvajPodsetnik({
        sirovi_tekst: izgovoreniTekst,
        naslov: aktuelnoParsirano.naslov,
        klijent_ime: aktuelnoParsirano.klijent_ime,
        klijent_telefon: aktuelnoParsirano.klijent_telefon,
        lokacija: aktuelnoParsirano.lokacija,
        iznos: aktuelnoParsirano.iznos,
        valuta: aktuelnoParsirano.valuta,
        obracunaj_pdv: aktuelnoParsirano.obracunaj_pdv,
        pdv_procenat: aktuelnoParsirano.pdv_procenat,
        pdv_iznos: aktuelnoParsirano.pdv_iznos,
        ukupno_sa_pdv: aktuelnoParsirano.ukupno_sa_pdv,
        je_kapara: aktuelnoParsirano.je_kapara,
        rok_datum: aktuelnoParsirano.rok_datum,
        opis_zadatka: aktuelnoParsirano.opis_zadatka,
        napomene: aktuelnoParsirano.napomene,
        stavke: aktuelnoParsirano.stavke,
        tip_zabelezke: aktivniTipSnimanja,
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

  const obrisiPoUuid = (uuid: string) => {
    const item = podsetnici.find(p => p.uuid_lokalni === uuid);
    if (item) {
      obrisiOdredjeniPodsetnik(item);
    } else {
      StorageService.obrisiPodsetnik(uuid).then(() => ucitajPodatke());
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

  const filtriraniPoslovi = posloviZaTab
    .filter(p => p.tip_zabelezke === 'posao' || (!p.tip_zabelezke && !p.rok_datum && (!p.stavke || !p.stavke.some(s => s.kupljeno !== undefined))))
    .filter(p => {
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
        const uNaslovu = p.naslov && p.naslov.toLowerCase().includes(q);
        const uImenu = p.klijent_ime && p.klijent_ime.toLowerCase().includes(q);
        const uOpisu = p.opis_zadatka && p.opis_zadatka.toLowerCase().includes(q);
        const uLokaciji = p.lokacija && p.lokacija.toLowerCase().includes(q);
        const uTel = p.klijent_telefon && p.klijent_telefon.includes(q);
        const uStavkama = p.stavke && p.stavke.some(s => s.opis.toLowerCase().includes(q));
        return uNaslovu || uImenu || uOpisu || uLokaciji || uTel || uStavkama;
      }

      return true;
    })
    .sort((a, b) => new Date(b.kreirano_na_uredjaju).getTime() - new Date(a.kreirano_na_uredjaju).getTime());

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

      {/* GLAVNI MENI: POSAO / NABAVKA / ZAKAZANI POSLOVI */}
      <View style={styles.glavniMeniKontejner}>
        <TouchableOpacity
          style={[styles.glavniMeniTab, glavniPrikaz === 'poslovi' && styles.glavniMeniTabAktivno]}
          onPress={() => setGlavniPrikaz('poslovi')}
          activeOpacity={0.7}
        >
          <Text style={[styles.glavniMeniTekst, glavniPrikaz === 'poslovi' && styles.glavniMeniTekstAktivno]}>
            🔨 Posao ({aktivniPoslovi.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.glavniMeniTab, glavniPrikaz === 'nabavka' && styles.glavniMeniTabAktivno]}
          onPress={() => setGlavniPrikaz('nabavka')}
          activeOpacity={0.7}
        >
          <Text style={[styles.glavniMeniTekst, glavniPrikaz === 'nabavka' && styles.glavniMeniTekstAktivno]}>
            🛒 Nabavka
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
            📅 Zakazani poslovi
          </Text>
        </TouchableOpacity>
      </View>

      {/* PRIKAZ 1: ZA NABAVKU (LISTA ARTIKALA ZA STOVARIŠTE / PRODAVNICU) */}
      {glavniPrikaz === 'nabavka' && (
        <NabavkaView
          podsetnici={podsetnici}
          onOtvoriEdit={otvoriModalZaIzmenu}
          onObrisi={(uuid) => obrisiPoUuid(uuid)}
          onDodajNovuNabavku={() => otvoriModalZaGovor('nabavka')}
        />
      )}

      {/* PRIKAZ 2: ZAKAZANI POSLOVI (IME, PREZIME, TELEFON, ADRESA, NAVIGACIJA, TERMIN) */}
      {glavniPrikaz === 'kalendar' && (
        <ZakazaniPosloviView
          podsetnici={podsetnici}
          onIzaberiPosao={otvoriModalZaIzmenu}
          onObrisi={(uuid) => obrisiPoUuid(uuid)}
          onZavrsiPosao={prebaciZavrseno}
          onDodajZakazani={() => otvoriModalZaGovor('zakazano')}
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
            renderItem={({ item, index }) => {
              const statusBoja = uzmiStatusBoju(item);
              const naslovPrikaz = item.naslov || (item.klijent_ime ? `Posao - ${item.klijent_ime}` : item.opis_zadatka) || `Posao #${item.uuid_lokalni.slice(-4)}`;
              const brojStavki = item.stavke ? item.stavke.length : 0;
              const datumKreiranja = new Date(item.kreirano_na_uredjaju).toLocaleDateString('sr-RS', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
              });
              const ukupnoPrikaz = (item.ukupno_sa_pdv || item.iznos || 0).toLocaleString('sr-RS');

              return (
                <TouchableOpacity
                  style={[
                    styles.posaoKarticaRed,
                    { borderLeftColor: statusBoja, borderLeftWidth: 4 },
                    item.je_zavrseno && styles.posaoKarticaZavrseno
                  ]}
                  activeOpacity={0.8}
                  onPress={() => otvoriModalZaIzmenu(item)}
                >
                  {/* Levo: Ikona i Redni broj */}
                  <View style={styles.posaoIkonaOmotac}>
                    <Text style={styles.posaoIkonaTekst}>🔨</Text>
                    <Text style={styles.posaoRedniBroj}>#{index + 1}</Text>
                  </View>

                  {/* Sredina: Naslov, klijent/lokacija, sažetak stavki, datum */}
                  <View style={styles.posaoSredina}>
                    <View style={styles.posaoGornjiRed}>
                      <Text style={styles.posaoNaslov} numberOfLines={1}>
                        {naslovPrikaz}
                      </Text>
                      <Text style={styles.posaoDatumTekst}>{datumKreiranja}</Text>
                    </View>

                    {item.klijent_ime || item.lokacija ? (
                      <Text style={styles.posaoKlijentLokacija} numberOfLines={1}>
                        {item.klijent_ime ? `👤 ${item.klijent_ime}` : ''}
                        {item.klijent_ime && item.lokacija ? ' • ' : ''}
                        {item.lokacija ? `📍 ${item.lokacija}` : ''}
                      </Text>
                    ) : null}

                    <Text style={styles.posaoSazetakStavki} numberOfLines={1}>
                      {brojStavki > 0
                        ? `📋 ${brojStavki} stavki specifikacije (${item.stavke!.slice(0, 3).map(s => s.opis).join(', ')}${brojStavki > 3 ? '...' : ''})`
                        : (item.opis_zadatka || 'Bez detaljnog opisa')}
                    </Text>

                    {item.rok_datum ? (
                      <Text style={styles.posaoRokTekst}>
                        ⏰ Rok: {new Date(item.rok_datum).toLocaleDateString('sr-RS', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    ) : null}
                  </View>

                  {/* Desno: Iznos i akciona dugmad */}
                  <View style={styles.posaoDesnoKontejner}>
                    <View style={styles.posaoIznosBedz}>
                      <Text style={styles.posaoIznosCifra}>{ukupnoPrikaz}</Text>
                      <Text style={styles.posaoIznosValuta}>{item.valuta}</Text>
                    </View>

                    <View style={styles.posaoAkcijeRed}>
                      <TouchableOpacity
                        style={styles.btnMalaAkcijaPosao}
                        onPress={() => PdfService.otvoriIliPodeliPdf(item, korisnik)}
                      >
                        <Text style={styles.btnAkcijaTekst}>📄</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.btnMalaAkcijaPosao}
                        onPress={() => otvoriModalZaIzmenu(item)}
                      >
                        <Text style={styles.btnAkcijaTekst}>✏️</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.btnMalaAkcijaPosao, styles.btnMalaAkcijaBrisi]}
                        onPress={() => obrisiOdredjeniPodsetnik(item)}
                      >
                        <Text style={styles.btnAkcijaTekst}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}

      {/* Glavno dugme: ZAPIŠI TO prilagođeno aktivnom tabu */}
      <View style={styles.floatingButtonContainer}>
        <TouchableOpacity
          style={styles.btnGlavnoGlas}
          onPress={() => otvoriModalZaGovor(glavniPrikaz === 'nabavka' ? 'nabavka' : (glavniPrikaz === 'kalendar' ? 'zakazano' : 'posao'))}
          activeOpacity={0.85}
        >
          <Text style={styles.btnGlavnoGlasIkona}>🎙️</Text>
          <Text style={styles.btnGlavnoGlasTekst}>
            {glavniPrikaz === 'nabavka'
              ? 'ZAPIŠI NABAVKU (GOVOR)'
              : (glavniPrikaz === 'kalendar' ? 'ZAKAŽI TERMIN (GOVOR)' : 'ZAPIŠI SPECIFIKACIJU (GOVOR)')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Modal za brzi govor i popunjavanje dokumenta */}
      {modalOtvoren && (
        <View style={[StyleSheet.absoluteFill, styles.modalOverlay, jeDesktopTablet && styles.modalOverlayDesktop, { zIndex: 9999 }]}>
          <View style={[styles.modalSadrzaj, jeDesktopTablet && styles.modalSadrzajDesktop]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalNaslov}>
                {aktivniTipSnimanja === 'nabavka'
                  ? '🛒 DOKUMENT: LISTA ZA NABAVKU'
                  : (aktivniTipSnimanja === 'zakazano' ? '📅 DOKUMENT: ZAKAZANI TERMIN' : '🔨 DOKUMENT: SPECIFIKACIJA POSLA')}
              </Text>
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
                    <Text style={styles.snimanjeTekstPod}>Slušam vaš govor i popunjavam dokument</Text>
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
              placeholder={
                aktivniTipSnimanja === 'nabavka'
                  ? "npr. Jabuke 2kg, Banane 1 kg, kafa 200gr, 2 hleba, mleko 1 litar"
                  : (aktivniTipSnimanja === 'zakazano'
                      ? "npr. Jovan Petrović, 064 123 4567, Smederevo Knez Mihailova 12, sutra u 10 sati, krečenje stana"
                      : "npr. Podna pločica 120 kvadrata po 2800 dinara, lepak 1200 kg po 95 dinara, fug masa 150 kg po 320 dinara")
              }
              placeholderTextColor="#71717A"
              value={izgovoreniTekst}
              onChangeText={rukujIzmenomTeksta}
              autoFocus
            />

            {/* Brzi tasteri za simulaciju realnog govora majstora prema aktivnom tabu */}
            <Text style={styles.brziPrimeriNaslov}>Isprobajte brzi primer jednim klikom:</Text>
            <View style={styles.primeriContainer}>
              {aktivniTipSnimanja === 'nabavka' ? (
                <>
                  <TouchableOpacity
                    style={styles.chipPrimer}
                    onPress={() => rukujIzmenomTeksta('Jabuke 2kg, Banane 1 kg, kafa 200gr, krompir 3 kg')}
                  >
                    <Text style={styles.chipPrimerTekst}>"🛒 Jabuke 2kg, Banane 1 kg, kafa 200gr..."</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.chipPrimer}
                    onPress={() => rukujIzmenomTeksta('2 hleba, 1 litar mleka, 300 grama sira, 10 jaja')}
                  >
                    <Text style={styles.chipPrimerTekst}>"🛒 2 hleba, 1 litar mleka, 300gr sira..."</Text>
                  </TouchableOpacity>
                </>
              ) : aktivniTipSnimanja === 'zakazano' ? (
                <>
                  <TouchableOpacity
                    style={styles.chipPrimer}
                    onPress={() => rukujIzmenomTeksta('Jovan Petrović, 064 123 4567, Smederevo Knez Mihailova 12, sutra u 10 sati, krečenje stana')}
                  >
                    <Text style={styles.chipPrimerTekst}>"📅 Jovan Petrović, 064 123 4567, Smederevo..."</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.chipPrimer}
                    onPress={() => rukujIzmenomTeksta('Milan Simić, 065 999 888, Beograd Bulevar 45, petak u 14h, popravka bojlera')}
                  >
                    <Text style={styles.chipPrimerTekst}>"📅 Milan Simić, 065..., petak u 14h..."</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.chipPrimer}
                    onPress={() => rukujIzmenomTeksta('Podna pločica 120 kvadrata po 2800 dinara, zidna pločica 85 kvadrata po 1950 dinara, lepak za pločice 1200 kg po 95 dinara')}
                  >
                    <Text style={styles.chipPrimerTekst}>"🔨 Podna pločica 120 kv po 2800 din, lepak..."</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.chipPrimer}
                    onPress={() => rukujIzmenomTeksta('Krečenje 150 kvadrata po 250 dinara, gletovanje 150 kvadrata po 300 dinara')}
                  >
                    <Text style={styles.chipPrimerTekst}>"🔨 Krečenje 150kv po 250, gletovanje..."</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* PREGLED POPUNJENOG DOKUMENTA U REALNOM VREMENU */}
            {parsirano && (
              <View style={styles.pregledKartica}>
                <Text style={styles.pregledNaslov}>
                  ⚡ Automatski popunjen dokument ({parsirano.stavke ? parsirano.stavke.length : 1} stavki):
                </Text>

                {/* 1. AKO JE NABAVKA (Prikaz po slici 2: Namirnica + Količina) */}
                {aktivniTipSnimanja === 'nabavka' && parsirano.stavke && parsirano.stavke.length > 0 ? (
                  <View style={styles.pregledTabelaNabavka}>
                    <View style={styles.pregledTabelaNabavkaHeader}>
                      <Text style={[styles.pregledColHeader, { width: 30 }]}>Br.</Text>
                      <Text style={[styles.pregledColHeader, { flex: 2 }]}>Namirnica</Text>
                      <Text style={[styles.pregledColHeader, { flex: 1.2 }]}>Količina</Text>
                    </View>
                    {parsirano.stavke.map((st, i) => (
                      <View key={i} style={styles.pregledTabelaNabavkaRed}>
                        <Text style={[styles.pregledCellTekst, { width: 30, color: '#10B981', fontWeight: 'bold' }]}>
                          {i + 1}
                        </Text>
                        <Text style={[styles.pregledCellTekst, { flex: 2, fontWeight: '700' }]}>
                          {st.opis}
                        </Text>
                        <Text style={[styles.pregledCellTekst, { flex: 1.2, color: '#38BDF8' }]}>
                          {st.kolicina || '1 kom'}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {/* 2. AKO JE POSAO (Prikaz po slici 1: Br, Opis, Jed. mere, Količina, Cena, Ukupno) */}
                {aktivniTipSnimanja === 'posao' && parsirano.stavke && parsirano.stavke.length > 0 ? (
                  <View style={styles.pregledTabelaPosao}>
                    <View style={styles.pregledTabelaNabavkaHeader}>
                      <Text style={[styles.pregledColHeader, { width: 25 }]}>Br.</Text>
                      <Text style={[styles.pregledColHeader, { flex: 2 }]}>Opis</Text>
                      <Text style={[styles.pregledColHeader, { width: 45 }]}>Jed.</Text>
                      <Text style={[styles.pregledColHeader, { width: 45 }]}>Kol.</Text>
                      <Text style={[styles.pregledColHeader, { width: 65, textAlign: 'right' }]}>Cena</Text>
                      <Text style={[styles.pregledColHeader, { width: 75, textAlign: 'right' }]}>Ukupno</Text>
                    </View>
                    {parsirano.stavke.map((st, i) => (
                      <View key={i} style={styles.pregledTabelaNabavkaRed}>
                        <Text style={[styles.pregledCellTekst, { width: 25, color: '#F59E0B', fontWeight: 'bold' }]}>
                          {i + 1}
                        </Text>
                        <Text style={[styles.pregledCellTekst, { flex: 2, fontWeight: '600' }]} numberOfLines={1}>
                          {st.opis}
                        </Text>
                        <Text style={[styles.pregledCellTekst, { width: 45, color: '#94A3B8' }]}>
                          {st.jed_mere || 'kom'}
                        </Text>
                        <Text style={[styles.pregledCellTekst, { width: 45 }]}>
                          {String(st.kolicina || 1)}
                        </Text>
                        <Text style={[styles.pregledCellTekst, { width: 65, textAlign: 'right' }]}>
                          {st.jed_cena ? st.jed_cena.toLocaleString('sr-RS') : '-'}
                        </Text>
                        <Text style={[styles.pregledCellTekst, { width: 75, textAlign: 'right', fontWeight: 'bold', color: '#10B981' }]}>
                          {st.iznos.toLocaleString('sr-RS')}
                        </Text>
                      </View>
                    ))}
                    <View style={styles.pregledZbirKutija}>
                      <Text style={styles.pregledZbirTekst}>
                        UKUPNO: <Text style={{ color: '#10B981', fontWeight: 'bold' }}>{(parsirano.ukupno_sa_pdv || parsirano.iznos).toLocaleString('sr-RS')} {parsirano.valuta}</Text>
                      </Text>
                    </View>
                  </View>
                ) : null}

                {/* 3. AKO JE ZAKAZANI TERMIN */}
                {aktivniTipSnimanja === 'zakazano' ? (
                  <View style={styles.pregledZakazanoKutija}>
                    <Text style={styles.pregledStavka}>
                      👤 Klijent: <Text style={{ color: '#fff', fontWeight: 'bold' }}>{parsirano.klijent_ime || 'Nije prepoznato'}</Text>
                    </Text>
                    {parsirano.klijent_telefon ? (
                      <Text style={styles.pregledStavka}>
                        📞 Telefon: <Text style={{ color: '#FDE047', fontWeight: 'bold' }}>{parsirano.klijent_telefon}</Text>
                      </Text>
                    ) : null}
                    {parsirano.lokacija ? (
                      <Text style={styles.pregledStavka}>
                        📍 Adresa/Grad: <Text style={{ color: '#38BDF8', fontWeight: 'bold' }}>{parsirano.lokacija}</Text>
                      </Text>
                    ) : null}
                    {parsirano.rok_datum ? (
                      <Text style={styles.pregledStavka}>
                        ⏰ Termin: <Text style={{ color: '#F43F5E', fontWeight: 'bold' }}>{new Date(parsirano.rok_datum).toLocaleString('sr-RS')}</Text>
                      </Text>
                    ) : null}
                    <Text style={styles.pregledStavka}>
                      📝 Napomena: <Text style={{ color: '#CBD5E1' }}>{parsirano.opis_zadatka}</Text>
                    </Text>
                  </View>
                ) : null}

                <TouchableOpacity style={styles.btnSacuvajPotvrda} onPress={sacuvajNoviPodsetnik}>
                  <Text style={styles.btnSacuvajPotvrdaTekst}>✓ SAČUVAJ DOKUMENT U LISTU</Text>
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

      {/* 1. MODAL ZA SPECIFIKACIJU POSLA (SLIKA 1) */}
      {editUnosOtvoren && (izabraniPodsetnikZaEdit?.tip_zabelezke === 'posao' || !izabraniPodsetnikZaEdit?.tip_zabelezke) && (
        <SpecifikacijaModal
          vidljiv={editUnosOtvoren}
          posao={izabraniPodsetnikZaEdit}
          korisnik={korisnik}
          onZatvori={() => {
            setEditUnosOtvoren(false);
            setIzabraniPodsetnikZaEdit(null);
          }}
          onSacuvaj={async (azuriran) => {
            await StorageService.azurirajPodsetnik(azuriran.uuid_lokalni, azuriran);
            await ucitajPodatke();
            SyncService.izvrsiSinhronizaciju().then(() => ucitajPodatke());
            Alert.alert('Sačuvano', 'Specifikacija i promene su uspešno ažurirane!');
          }}
        />
      )}

      {/* 2. MODAL ZA NABAVKU / LISTU ZA KUPOVINU (SLIKA 2) */}
      {editUnosOtvoren && izabraniPodsetnikZaEdit?.tip_zabelezke === 'nabavka' && (
        <NabavkaModal
          vidljiv={editUnosOtvoren}
          nabavka={izabraniPodsetnikZaEdit}
          onZatvori={() => {
            setEditUnosOtvoren(false);
            setIzabraniPodsetnikZaEdit(null);
          }}
          onSacuvaj={async (azuriran) => {
            await StorageService.azurirajPodsetnik(azuriran.uuid_lokalni, azuriran);
            await ucitajPodatke();
            SyncService.izvrsiSinhronizaciju().then(() => ucitajPodatke());
            Alert.alert('Sačuvano', 'Lista za nabavku je uspešno ažurirana!');
          }}
        />
      )}

      {/* 3. MODAL ZA ZAKAZANI POSAO / TERMIN */}
      {editUnosOtvoren && izabraniPodsetnikZaEdit?.tip_zabelezke === 'zakazano' && (
        <ZakazaniPosaoModal
          vidljiv={editUnosOtvoren}
          posao={izabraniPodsetnikZaEdit}
          onZatvori={() => {
            setEditUnosOtvoren(false);
            setIzabraniPodsetnikZaEdit(null);
          }}
          onSacuvaj={async (azuriran) => {
            await StorageService.azurirajPodsetnik(azuriran.uuid_lokalni, azuriran);
            await ucitajPodatke();
            SyncService.izvrsiSinhronizaciju().then(() => ucitajPodatke());
            Alert.alert('Sačuvano', 'Zakazani termin je uspešno ažuriran!');
          }}
        />
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
  },
  // Redizajnirana kartica posla kao jedan kompaktan red
  posaoKarticaRed: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155'
  },
  posaoKarticaZavrseno: {
    opacity: 0.55
  },
  posaoIkonaOmotac: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  posaoIkonaTekst: {
    fontSize: 20
  },
  posaoRedniBroj: {
    fontSize: 9,
    color: '#F59E0B',
    fontWeight: '900'
  },
  posaoSredina: {
    flex: 1,
    marginRight: 8
  },
  posaoGornjiRed: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3
  },
  posaoNaslov: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
    flex: 1,
    marginRight: 6
  },
  posaoDatumTekst: {
    fontSize: 11,
    color: '#64748B'
  },
  posaoKlijentLokacija: {
    fontSize: 12,
    color: '#38BDF8',
    fontWeight: '600',
    marginBottom: 3
  },
  posaoSazetakStavki: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 3
  },
  posaoRokTekst: {
    fontSize: 11,
    color: '#F59E0B',
    fontWeight: '600'
  },
  posaoDesnoKontejner: {
    alignItems: 'flex-end',
    justifyContent: 'space-between'
  },
  posaoIznosBedz: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4
  },
  posaoIznosCifra: {
    fontSize: 13,
    fontWeight: '900',
    color: '#10B981'
  },
  posaoIznosValuta: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#64748B'
  },
  posaoAkcijeRed: {
    flexDirection: 'row',
    gap: 4
  },
  btnMalaAkcijaPosao: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center'
  },
  btnMalaAkcijaBrisi: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)'
  },
  btnAkcijaTekst: {
    fontSize: 14
  },
  // Stilovi za pregled popunjenih tabela u snimanju
  pregledTabelaNabavka: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 10,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#334155'
  },
  pregledTabelaNabavkaHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 6,
    marginBottom: 4
  },
  pregledColHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B'
  },
  pregledTabelaNabavkaRed: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(51, 65, 85, 0.4)'
  },
  pregledCellTekst: {
    fontSize: 12,
    color: '#F8FAFC'
  },
  pregledTabelaPosao: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 10,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#334155'
  },
  pregledZbirKutija: {
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    alignItems: 'flex-end'
  },
  pregledZbirTekst: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#F8FAFC'
  },
  pregledZakazanoKutija: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 10,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 4
  }
});
