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

    // Automatska periodična sinhronizacija na svakih 25 sekundi
    const syncInterval = setInterval(() => {
      SyncService.izvrsiSinhronizaciju().then(() => ucitajPodatke());
    }, 25000);

    if (Platform.OS === 'web') {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
      setSpeechPodrzan(!!SpeechRecognition);
    } else {
      VoiceService.isAvailable().then(avail => setSpeechPodrzan(avail));
    }

    return () => clearInterval(syncInterval);
  }, []);

  // Automatska sinhronizacija i osvežavanje pri promeni taba
  useEffect(() => {
    ucitajPodatke();
    SyncService.izvrsiSinhronizaciju().then(() => ucitajPodatke());
  }, [glavniPrikaz]);

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
    const tip = item.tip_zabelezke || (glavniPrikaz === 'nabavka' ? 'nabavka' : (glavniPrikaz === 'kalendar' ? 'zakazano' : 'posao'));
    const itemSaTipom: LokalniPodsetnik = {
      ...item,
      tip_zabelezke: tip,
      naslov: tip === 'nabavka' && (!item.naslov || item.naslov.includes('Građevinsk') || item.naslov.includes('Posao'))
        ? 'Lista za nabavku'
        : item.naslov
    };
    setIzabraniPodsetnikZaEdit(itemSaTipom);
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
    const naziv = item.klijent_ime
      ? `posao za klijenta "${item.klijent_ime}"`
      : (item.naslov || (item.tip_zabelezke === 'nabavka' ? 'ovu listu za nabavku' : 'ovaj zapis'));

    const izvrsiBrisanje = async () => {
      await StorageService.obrisiPodsetnik(item.uuid_lokalni);
      await ucitajPodatke();

      // Obriši i na serveru
      try {
        const isPhp = DEFAULT_API_URL.includes('.php');
        const url = isPhp ? `${DEFAULT_API_URL}?action=delete_podsetnik` : `${DEFAULT_API_URL}/podsetnici/delete`;
        await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${korisnik?.token || ''}`
          },
          body: JSON.stringify({
            uuid_lokalni: item.uuid_lokalni,
            korisnik_id: korisnik?.id
          })
        });
      } catch (e) {
        console.warn('Greška pri brisanju na serveru:', e);
      }
      await ucitajPodatke();
    };

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
        if (window.confirm(`Da li ste sigurni da želite da obrišete ${naziv}?`)) {
          izvrsiBrisanje();
        }
      } else {
        izvrsiBrisanje();
      }
    } else {
      Alert.alert(
        'Brisanje zapisa',
        `Da li ste sigurni da želite da obrišete ${naziv}?`,
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

  // Filtriranje poslova, nabavki i zakazanih termina po tipu
  const aktivniPoslovi = podsetnici.filter(
    p => !p.je_zavrseno && (p.tip_zabelezke === 'posao' || (!p.tip_zabelezke && !p.rok_datum && (!p.stavke || !p.stavke.some(s => s.kupljeno !== undefined))))
  );
  const zavrseniPoslovi = podsetnici.filter(
    p => p.je_zavrseno && (p.tip_zabelezke === 'posao' || (!p.tip_zabelezke && !p.rok_datum && (!p.stavke || !p.stavke.some(s => s.kupljeno !== undefined))))
  );

  const aktivneNabavke = podsetnici.filter(
    p => !p.je_zavrseno && (p.tip_zabelezke === 'nabavka' || (p.stavke && p.stavke.some(s => s.kupljeno !== undefined)))
  );
  const aktivniZakazani = podsetnici.filter(
    p => !p.je_zavrseno && p.tip_zabelezke === 'zakazano'
  );

  const danasPocetak = new Date();
  danasPocetak.setHours(0, 0, 0, 0);
  const danasKraj = new Date();
  danasKraj.setHours(23, 59, 59, 999);

  const posloviDanasBroj = aktivniPoslovi.filter(p => {
    if (!p.rok_datum) return false;
    const d = new Date(p.rok_datum);
    return d <= danasKraj;
  }).length;

  const posloviZaTab = filterStatus === 'aktivni' ? aktivniPoslovi : zavrseniPoslovi;

  const filtriraniPoslovi = posloviZaTab
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
            🛒 Nabavka ({aktivneNabavke.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.glavniMeniTab, glavniPrikaz === 'kalendar' && styles.glavniMeniTabAktivno]}
          onPress={() => setGlavniPrikaz('kalendar')}
          activeOpacity={0.7}
        >
          <Text style={[styles.glavniMeniTekst, glavniPrikaz === 'kalendar' && styles.glavniMeniTekstAktivno]}>
            📅 Zakazani poslovi ({aktivniZakazani.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* PRIKAZ 1: ZA NABAVKU (LISTA ARTIKALA ZA STOVARIŠTE / PRODAVNICU) */}
      {glavniPrikaz === 'nabavka' && (
        <NabavkaView
          podsetnici={podsetnici}
          onOtvoriEdit={otvoriModalZaIzmenu}
          onObrisi={(uuid) => obrisiPoUuid(uuid)}
          onAzuriraj={async (azuriran) => {
            await StorageService.azurirajPodsetnik(azuriran.uuid_lokalni, azuriran);
            await ucitajPodatke();
            SyncService.izvrsiSinhronizaciju().then(() => ucitajPodatke());
          }}
        />
      )}

      {/* PRIKAZ 2: ZAKAZANI POSLOVI (IME, PREZIME, TELEFON, ADRESA, NAVIGACIJA, TERMIN) */}
      {glavniPrikaz === 'kalendar' && (
        <ZakazaniPosloviView
          podsetnici={podsetnici}
          onIzaberiPosao={otvoriModalZaIzmenu}
          onObrisi={(uuid) => obrisiPoUuid(uuid)}
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
                      {item.klijent_telefon ? (
                        <TouchableOpacity
                          style={[styles.btnMalaAkcijaPosao, { backgroundColor: '#ECFDF5' }]}
                          onPress={(e: any) => {
                            e?.stopPropagation?.();
                            Linking.openURL(`tel:${item.klijent_telefon}`);
                          }}
                        >
                          <Text style={styles.btnAkcijaTekst}>📞</Text>
                        </TouchableOpacity>
                      ) : null}

                      <TouchableOpacity
                        style={[styles.btnMalaAkcijaPosao, { backgroundColor: '#F0FDF4' }]}
                        onPress={(e: any) => {
                          e?.stopPropagation?.();
                          posaljiPorukuKlijentu(item);
                        }}
                      >
                        <Text style={styles.btnAkcijaTekst}>💬</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.btnMalaAkcijaPosao}
                        onPress={(e: any) => {
                          e?.stopPropagation?.();
                          PdfService.otvoriIliPodeliPdf(item, korisnik);
                        }}
                      >
                        <Text style={styles.btnAkcijaTekst}>📄</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.btnMalaAkcijaPosao}
                        onPress={(e: any) => {
                          e?.stopPropagation?.();
                          otvoriModalZaIzmenu(item);
                        }}
                      >
                        <Text style={styles.btnAkcijaTekst}>✏️</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.btnMalaAkcijaPosao, styles.btnMalaAkcijaBrisi]}
                        onPress={(e: any) => {
                          e?.stopPropagation?.();
                          obrisiOdredjeniPodsetnik(item);
                        }}
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

            {/* Indikator preostalog broja karaktera (do 500) */}
            <View style={styles.brojacKarakteraRed}>
              <Text style={styles.brojacKarakteraLabel}>
                📝 {aktivniTipSnimanja === 'nabavka' ? 'Stavke za nabavku' : aktivniTipSnimanja === 'zakazano' ? 'Podaci o zakazanom poslu' : 'Specifikacija posla'}:
              </Text>
              <Text
                style={[
                  styles.brojacKarakteraBroj,
                  500 - izgovoreniTekst.length <= 50 && styles.brojacKarakteraUpozorenje
                ]}
              >
                Preostalo još: {Math.max(0, 500 - izgovoreniTekst.length)} / 500 karaktera
              </Text>
            </View>

            <TextInput
              style={styles.modalInput}
              multiline
              maxLength={500}
              placeholder={
                aktivniTipSnimanja === 'nabavka'
                  ? "npr. Jabuke 2kg, Banane 1 kg, kafa 200gr, 2 hleba, mleko 1 litar"
                  : (aktivniTipSnimanja === 'zakazano'
                      ? "npr. Jovan Petrović, 064 123 4567, Smederevo Knez Mihailova 12, sutra u 10 sati, krečenje stana"
                      : "npr. Podna pločica 120 kvadrata po 2800 dinara, lepak 1200 kg po 95 dinara, fug masa 150 kg po 320 dinara")
              }
              placeholderTextColor="#94A3B8"
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
                      👤 Klijent: <Text style={{ color: '#0F172A', fontWeight: 'bold' }}>{parsirano.klijent_ime || 'Nije prepoznato'}</Text>
                    </Text>
                    {parsirano.klijent_telefon ? (
                      <Text style={styles.pregledStavka}>
                        📞 Telefon: <Text style={{ color: '#0369A1', fontWeight: 'bold' }}>{parsirano.klijent_telefon}</Text>
                      </Text>
                    ) : null}
                    {parsirano.lokacija ? (
                      <Text style={styles.pregledStavka}>
                        📍 Adresa/Grad: <Text style={{ color: '#0284C7', fontWeight: 'bold' }}>{parsirano.lokacija}</Text>
                      </Text>
                    ) : null}
                    {parsirano.rok_datum ? (
                      <Text style={styles.pregledStavka}>
                        ⏰ Termin: <Text style={{ color: '#E11D48', fontWeight: 'bold' }}>{new Date(parsirano.rok_datum).toLocaleString('sr-RS')}</Text>
                      </Text>
                    ) : null}
                    <Text style={styles.pregledStavka}>
                      📝 Napomena: <Text style={{ color: '#334155' }}>{parsirano.opis_zadatka}</Text>
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
          key={izabraniPodsetnikZaEdit.uuid_lokalni}
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
            if (Platform.OS === 'web') {
              window.alert('Specifikacija i promene su uspešno ažurirane!');
            } else {
              Alert.alert('Sačuvano', 'Specifikacija i promene su uspešno ažurirane!');
            }
          }}
        />
      )}

      {/* 2. MODAL ZA NABAVKU / LISTU ZA KUPOVINU (SLIKA 2) */}
      {editUnosOtvoren && izabraniPodsetnikZaEdit?.tip_zabelezke === 'nabavka' && (
        <NabavkaModal
          key={izabraniPodsetnikZaEdit.uuid_lokalni}
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
            if (Platform.OS === 'web') {
              window.alert('Lista za nabavku je uspešno ažurirana!');
            } else {
              Alert.alert('Sačuvano', 'Lista za nabavku je uspešno ažurirana!');
            }
          }}
        />
      )}

      {/* 3. MODAL ZA ZAKAZANI POSAO / TERMIN */}
      {editUnosOtvoren && izabraniPodsetnikZaEdit?.tip_zabelezke === 'zakazano' && (
        <ZakazaniPosaoModal
          key={izabraniPodsetnikZaEdit.uuid_lokalni}
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
            if (Platform.OS === 'web') {
              window.alert('Zakazani termin je uspešno ažuriran!');
            } else {
              Alert.alert('Sačuvano', 'Zakazani termin je uspešno ažuriran!');
            }
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  topBar: {
    paddingTop: 45,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2
  },
  logoTekst: { fontSize: 24, fontWeight: '900', color: '#059669' },
  korisnikLabel: { fontSize: 12, color: '#64748B', marginTop: 2 },
  topDugmad: { flexDirection: 'row', gap: 8 },
  btnAdmin: { backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#FDE68A' },
  btnAdminTekst: { color: '#92400E', fontWeight: '800', fontSize: 12 },
  btnOdjava: { backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  btnOdjavaTekst: { color: '#475569', fontSize: 12, fontWeight: '600' },
  bannerContainer: { backgroundColor: '#EFF6FF', padding: 12, borderBottomWidth: 1, borderColor: '#DBEAFE' },
  bannerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bannerTekst: { color: '#1E40AF', fontSize: 13 },
  btnSync: { backgroundColor: '#0284C7', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  btnSyncTekst: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  licencaTekst: { color: '#64748B', fontSize: 11, marginTop: 4 },
  posloviBarContainer: {
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2
  },
  posloviInfo: {
    flex: 1
  },
  posloviNaslov: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800'
  },
  posloviPodnaslov: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2
  },
  taboviKontejner: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  tabDugme: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8
  },
  tabDugmeAktivno: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1
  },
  tabDugmeTekst: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700'
  },
  tabDugmeTekstAktivno: {
    color: '#0F172A',
    fontWeight: '900'
  },
  prazno: { alignItems: 'center', marginTop: 40, paddingHorizontal: 20 },
  praznoIkona: { fontSize: 42, marginBottom: 8 },
  praznoTekst: { color: '#0F172A', fontSize: 18, fontWeight: '800' },
  praznoPodtekst: { color: '#64748B', fontSize: 14, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  demoKutija: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 14,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    width: '100%'
  },
  demoKutijaNaslov: { color: '#059669', fontSize: 14, fontWeight: '800', marginBottom: 6 },
  demoKutijaTekst: { color: '#475569', fontSize: 13, lineHeight: 19, marginTop: 4 },
  kartica: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2
  },
  karticaZavrseno: { opacity: 0.6, backgroundColor: '#F8FAFC' },
  karticaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  karticaKlijent: { fontSize: 16, fontWeight: '800', color: '#059669' },
  karticaZadatak: { fontSize: 14, color: '#1E293B', marginTop: 4, lineHeight: 20 },
  iznosBadge: { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, alignItems: 'center' },
  iznosTekst: { color: '#059669', fontWeight: '900', fontSize: 15 },
  kaparaTekst: { color: '#D97706', fontSize: 9, fontWeight: '900' },
  rokTekst: { color: '#2563EB', fontSize: 13, marginTop: 10, fontWeight: '600' },
  btnPoruka: {
    backgroundColor: '#25D366',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnPorukaTekst: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  karticaFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 },
  btnZavrsi: { backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  btnZavrsiAktivno: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  btnZavrsiTekst: { color: '#334155', fontSize: 12, fontWeight: '600' },
  syncStatus: { marginLeft: 'auto', fontSize: 11, color: '#94A3B8' },
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
    paddingVertical: 16,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    ...Platform.select({
      web: {
        boxShadow: '0px 6px 16px rgba(16, 185, 129, 0.35)'
      },
      default: {
        shadowColor: '#10B981',
        shadowOpacity: 0.35,
        shadowRadius: 10
      }
    })
  },
  btnGlavnoGlasIkona: { fontSize: 24, marginRight: 10 },
  btnGlavnoGlasTekst: { color: '#FFFFFF', fontSize: 17, fontWeight: '900', letterSpacing: 0.5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end', alignItems: 'center' },
  modalOverlayDesktop: { justifyContent: 'center', padding: 20 },
  modalSadrzaj: { backgroundColor: '#FFFFFF', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%', width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 10 },
  modalSadrzajDesktop: { maxWidth: 560, borderRadius: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalNaslov: { color: '#0F172A', fontSize: 16, fontWeight: '700' },
  modalZatvori: { color: '#64748B', fontSize: 20, fontWeight: 'bold' },
  brojacKarakteraRed: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    paddingHorizontal: 2
  },
  brojacKarakteraLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569'
  },
  brojacKarakteraBroj: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669'
  },
  brojacKarakteraUpozorenje: {
    color: '#DC2626'
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    color: '#0F172A',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
    borderColor: '#CBD5E1',
    borderWidth: 1
  },
  brziPrimeriNaslov: { color: '#64748B', fontSize: 11, marginTop: 12, marginBottom: 6, fontWeight: '600' },
  primeriContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chipPrimer: { backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  chipPrimerTekst: { color: '#2563EB', fontSize: 11, fontWeight: '600' },
  pregledKartica: { backgroundColor: '#F0FDF4', padding: 14, borderRadius: 12, marginTop: 16, borderWidth: 1, borderColor: '#86EFAC' },
  pregledNaslov: { color: '#166534', fontSize: 12, fontWeight: '800', marginBottom: 8 },
  pregledStavka: { color: '#334155', fontSize: 13, marginBottom: 4 },
  btnSacuvajPotvrda: { backgroundColor: '#059669', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  btnSacuvajPotvrdaTekst: { color: '#fff', fontSize: 15, fontWeight: '900' },
  korisnikRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4
  },
  btnIkonaEdit: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1'
  },
  btnIkonaKanta: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FCA5A5'
  },
  profilLabel: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 10
  },
  profilInput: {
    backgroundColor: '#F8FAFC',
    color: '#0F172A',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    borderColor: '#CBD5E1',
    borderWidth: 1
  },
  lozinkaKontejner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderColor: '#CBD5E1',
    borderWidth: 1
  },
  lozinkaInput: {
    flex: 1,
    color: '#0F172A',
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
    backgroundColor: '#059669',
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
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12
  },
  mikrofonStatusKutijaAktivno: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5'
  },
  snimanjeRed: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  snimanjeTekstGlavni: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  snimanjeTekstSpreman: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700'
  },
  snimanjeTekstPod: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2
  },
  btnZavrsiSnimanje: {
    backgroundColor: '#DC2626',
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
    backgroundColor: '#059669',
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
    backgroundColor: '#EFF6FF',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 12
  },
  firefoxNaslov: {
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4
  },
  firefoxTekst: {
    color: '#1E293B',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2
  },
  karticaTelefon: {
    color: '#0369A1',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2
  },
  karticaSpecifikacija: {
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  karticaSpecifikacijaNaslov: {
    color: '#1D4ED8',
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
    color: '#334155',
    fontSize: 12,
    flex: 1
  },
  karticaSpecifikacijaCena: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '800'
  },
  pregledSpecifikacija: {
    backgroundColor: '#F0FDF4',
    padding: 10,
    borderRadius: 8,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#86EFAC'
  },
  pregledSpecifikacijaNaslov: {
    color: '#166534',
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
    color: '#1E293B',
    fontSize: 12,
    flex: 1
  },
  pregledSpecifikacijaCena: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '700'
  },
  pregledSpecifikacijaZbirRed: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderColor: '#86EFAC',
    paddingTop: 6,
    marginTop: 6
  },
  pregledSpecifikacijaZbirLabel: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '900'
  },
  pregledSpecifikacijaZbirVrednost: {
    color: '#059669',
    fontSize: 15,
    fontWeight: '900'
  },
  valutaBtn: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1'
  },
  valutaBtnAktivno: {
    backgroundColor: '#ECFDF5',
    borderColor: '#059669'
  },
  valutaBtnTekst: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700'
  },
  valutaBtnTekstAktivno: {
    color: '#059669',
    fontWeight: '900'
  },
  kaparaToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10
  },
  kaparaToggleTekst: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '600'
  },
  btnAkcijaPosao: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#CBD5E1'
  },
  btnKantaPosao: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5'
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
    backgroundColor: '#FEF2F2'
  },
  btnMikrofonPolje: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5
  },
  btnMikrofonPoljeAktivno: {
    backgroundColor: '#FEE2E2',
    borderColor: '#EF4444'
  },
  btnMikrofonPoljeIkona: {
    fontSize: 15
  },
  btnMikrofonPoljeTekst: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '700'
  },
  btnMikrofonPoljeTekstAktivno: {
    color: '#DC2626'
  },
  valutaIzborRed: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4
  },
  valutaVelikoDugme: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  valutaVelikoDugmeAktivno: {
    backgroundColor: '#ECFDF5',
    borderColor: '#059669'
  },
  valutaZastavica: {
    fontSize: 20
  },
  valutaVelikiNaslov: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700'
  },
  valutaVelikiNaslovAktivno: {
    color: '#059669',
    fontWeight: '900'
  },
  valutaCekirano: {
    color: '#059669',
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
    backgroundColor: '#F1F5F9',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnModalOdustaniTekst: {
    color: '#475569',
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
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative'
  },
  glavniMeniTabAktivno: {
    backgroundColor: '#ECFDF5',
    borderColor: '#059669'
  },
  glavniMeniTekst: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700'
  },
  glavniMeniTekstAktivno: {
    color: '#059669',
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
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
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
    color: '#991B1B',
    fontSize: 13,
    fontWeight: '800'
  },
  podsetnikDanasPod: {
    color: '#B91C1C',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  pretragaIkona: {
    fontSize: 14,
    marginRight: 8
  },
  pretragaInput: {
    flex: 1,
    color: '#0F172A',
    paddingVertical: 10,
    fontSize: 13
  },
  pretragaObrisi: {
    color: '#64748B',
    fontSize: 16,
    padding: 4
  },
  filterChipsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 8
  },
  chipFilter: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  chipFilterAktivno: {
    backgroundColor: '#ECFDF5',
    borderColor: '#059669'
  },
  chipFilterTekst: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600'
  },
  chipFilterTekstAktivno: {
    color: '#059669',
    fontWeight: '800'
  },
  chipLokacija: {
    backgroundColor: '#FEF9C3',
    borderWidth: 1,
    borderColor: '#FDE047',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginVertical: 4
  },
  chipLokacijaTekst: {
    color: '#854D0E',
    fontSize: 12,
    fontWeight: '700'
  },
  akcijeDvaReda: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12
  },
  btnPdfPredracun: {
    backgroundColor: '#EFF6FF',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE'
  },
  btnPdfPredracunTekst: {
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '800'
  },
  snimaPoljeIndicator: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  snimaPoljeIndicatorTekst: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700'
  },
  // Redizajnirana kartica posla kao jedan kompaktan red
  posaoKarticaRed: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2
  },
  posaoKarticaZavrseno: {
    opacity: 0.55
  },
  posaoIkonaOmotac: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  posaoIkonaTekst: {
    fontSize: 20
  },
  posaoRedniBroj: {
    fontSize: 9,
    color: '#D97706',
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
    color: '#0F172A',
    flex: 1,
    marginRight: 6
  },
  posaoDatumTekst: {
    fontSize: 11,
    color: '#64748B'
  },
  posaoKlijentLokacija: {
    fontSize: 12,
    color: '#0284C7',
    fontWeight: '600',
    marginBottom: 3
  },
  posaoSazetakStavki: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 3
  },
  posaoRokTekst: {
    fontSize: 11,
    color: '#D97706',
    fontWeight: '600'
  },
  posaoDesnoKontejner: {
    alignItems: 'flex-end',
    justifyContent: 'space-between'
  },
  posaoIznosBedz: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4
  },
  posaoIznosCifra: {
    fontSize: 13,
    fontWeight: '900',
    color: '#059669'
  },
  posaoIznosValuta: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#047857'
  },
  posaoAkcijeRed: {
    flexDirection: 'row',
    gap: 4
  },
  btnMalaAkcijaPosao: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  btnMalaAkcijaBrisi: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5'
  },
  btnAkcijaTekst: {
    fontSize: 14
  },
  // Stilovi za pregled popunjenih tabela u snimanju
  pregledTabelaNabavka: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 10,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  pregledTabelaNabavkaHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 6,
    marginBottom: 4
  },
  pregledColHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569'
  },
  pregledTabelaNabavkaRed: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  pregledCellTekst: {
    fontSize: 12,
    color: '#0F172A'
  },
  pregledTabelaPosao: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 10,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  pregledZbirKutija: {
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    alignItems: 'flex-end'
  },
  pregledZbirTekst: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0F172A'
  },
  pregledZakazanoKutija: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 10,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4
  }
});
