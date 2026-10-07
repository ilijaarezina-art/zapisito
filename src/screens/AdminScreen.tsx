import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  Platform
} from 'react-native';
import { StorageService } from '../services/storage';
import { DEFAULT_API_URL } from '../services/sync';

interface KorisnikAdminData {
  id: number;
  korisnicko_ime: string;
  ime: string | null;
  broj_telefona: string | null;
  token_active: number;
  token_expires_at: string | null;
  besplatni_unosi_iskorisceno: number;
  is_active: number;
  rola: string;
  ukupno_podsetnika: number;
}

const MESECI = [
  'Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun',
  'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'
];
const DANI_NEDELJE = ['Po', 'Ut', 'Sr', 'Če', 'Pe', 'Su', 'Ne'];

export default function AdminScreen({ onNazad }: { onNazad: () => void }) {
  const [korisnici, setKorisnici] = useState<KorisnikAdminData[]>([]);
  const [ucitava, setUcitava] = useState(true);
  const [osvezava, setOsvezava] = useState(false);

  // Stanje za Kalendar Modal
  const [kalendarOtvoren, setKalendarOtvoren] = useState(false);
  const [izabraniKorisnik, setIzabraniKorisnik] = useState<KorisnikAdminData | null>(null);
  const [prikazanaGodina, setPrikazanaGodina] = useState(new Date().getFullYear());
  const [prikazaniMesec, setPrikazaniMesec] = useState(new Date().getMonth());
  const [izabraniDatum, setIzabraniDatum] = useState<Date>(new Date());
  const [saljeZahtev, setSaljeZahtev] = useState(false);

  const ucitajKorisnike = async () => {
    try {
      const ulogovan = await StorageService.getKorisnik();
      if (!ulogovan || !ulogovan.token) return;

      const isPhp = DEFAULT_API_URL.includes('.php');
      const url = isPhp ? `${DEFAULT_API_URL}?action=admin_users` : `${DEFAULT_API_URL}/admin/korisnici`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${ulogovan.token}` }
      });
      const data = await res.json();
      if (res.ok && data.korisnici) {
        setKorisnici(data.korisnici);
      } else {
        Alert.alert('Greška', data.poruka || data.message || 'Nije moguće učitati korisnike.');
      }
    } catch (err: any) {
      Alert.alert('Greška u mreži', 'Proverite konekciju sa serverom.');
    } finally {
      setUcitava(false);
      setOsvezava(false);
    }
  };

  useEffect(() => {
    ucitajKorisnike();
  }, []);

  const otvoriKalendarZaKorisnika = (korisnik: KorisnikAdminData) => {
    setIzabraniKorisnik(korisnik);
    const pocetniDatum = korisnik.token_expires_at ? new Date(korisnik.token_expires_at) : new Date();
    setIzabraniDatum(pocetniDatum);
    setPrikazanaGodina(pocetniDatum.getFullYear());
    setPrikazaniMesec(pocetniDatum.getMonth());
    setKalendarOtvoren(true);
  };

  const promeniMesec = (smer: number) => {
    let noviM = prikazaniMesec + smer;
    let novaG = prikazanaGodina;
    if (noviM > 11) {
      noviM = 0;
      novaG += 1;
    } else if (noviM < 0) {
      noviM = 11;
      novaG -= 1;
    }
    setPrikazaniMesec(noviM);
    setPrikazanaGodina(novaG);
  };

  const postaviBrziDatum = (tip: '15' | '20' | 'kraj' | '30dana') => {
    const d = new Date();
    if (tip === '15') {
      // 15. u tekućem ili sledećem mesecu
      if (d.getDate() >= 15) {
        d.setMonth(d.getMonth() + 1);
      }
      d.setDate(15);
    } else if (tip === '20') {
      if (d.getDate() >= 20) {
        d.setMonth(d.getMonth() + 1);
      }
      d.setDate(20);
    } else if (tip === 'kraj') {
      // Poslednji dan u tekućem mesecu
      d.setMonth(d.getMonth() + 1, 0);
    } else if (tip === '30dana') {
      d.setDate(d.getDate() + 30);
    }
    setIzabraniDatum(d);
    setPrikazanaGodina(d.getFullYear());
    setPrikazaniMesec(d.getMonth());
  };

  const sacuvajIzabraniDatum = async () => {
    if (!izabraniKorisnik) return;
    setSaljeZahtev(true);
    try {
      const ulogovan = await StorageService.getKorisnik();
      if (!ulogovan?.token) return;

      const godina = izabraniDatum.getFullYear();
      const mesec = String(izabraniDatum.getMonth() + 1).padStart(2, '0');
      const dan = String(izabraniDatum.getDate()).padStart(2, '0');
      const formatiranDatum = `${godina}-${mesec}-${dan} 23:59:59`;

      const isPhp = DEFAULT_API_URL.includes('.php');
      const url = isPhp ? `${DEFAULT_API_URL}?action=admin_extend` : `${DEFAULT_API_URL}/admin/dodeli-pretplatu`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ulogovan.token}`
        },
        body: JSON.stringify({
          korisnik_id: izabraniKorisnik.id,
          tacan_datum: formatiranDatum
        })
      });
      const data = await res.json();
      if (res.ok) {
        Alert.alert('Uspeh!', `Pretplata za ${izabraniKorisnik.korisnicko_ime} podešena do ${dan}.${mesec}.${godina}.`);
        setKalendarOtvoren(false);
        ucitajKorisnike();
      } else {
        Alert.alert('Greška', data.poruka || data.message || 'Nije uspelo čuvanje.');
      }
    } catch (err: any) {
      Alert.alert('Greška', 'Došlo je do greške u komunikaciji sa serverom.');
    } finally {
      setSaljeZahtev(false);
    }
  };

  // Generisanje matrice dana za kalendar
  const generisiDaneZaMesec = () => {
    const prviDanUMesecu = new Date(prikazanaGodina, prikazaniMesec, 1).getDay();
    // Prebaci da nedelja bude 7 (ponedeljak = 1, nedelja = 7)
    const pomeraj = prviDanUMesecu === 0 ? 6 : prviDanUMesecu - 1;
    const brojDanaUMesecu = new Date(prikazanaGodina, prikazaniMesec + 1, 0).getDate();

    const dani: (number | null)[] = [];
    for (let i = 0; i < pomeraj; i++) {
      dani.push(null);
    }
    for (let i = 1; i <= brojDanaUMesecu; i++) {
      dani.push(i);
    }
    return dani;
  };

  const promeniStatusNaloga = async (korisnikId: number, trenutniStatus: number) => {
    try {
      const ulogovan = await StorageService.getKorisnik();
      if (!ulogovan?.token) return;

      const noviStatus = trenutniStatus === 1 ? 0 : 1;
      const isPhp = DEFAULT_API_URL.includes('.php');
      const url = isPhp ? `${DEFAULT_API_URL}?action=admin_toggle_status` : `${DEFAULT_API_URL}/admin/promeni-status`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ulogovan.token}`
        },
        body: JSON.stringify({ korisnik_id: korisnikId, is_active: noviStatus })
      });
      const data = await res.json();
      if (res.ok) {
        ucitajKorisnike();
      } else {
        Alert.alert('Greška', data.poruka || data.message);
      }
    } catch (err) {
      Alert.alert('Greška', 'Nije uspela promena statusa.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.btnNazad} onPress={onNazad}>
          <Text style={styles.btnNazadTekst}>← Nazad na aplikaciju</Text>
        </TouchableOpacity>
        <Text style={styles.naslov}>Super Admin Panel (Ilija)</Text>
        <Text style={styles.podnaslov}>Upravljanje licencama i datumima pretplate</Text>
      </View>

      {ucitava ? (
        <ActivityIndicator size="large" color="#10B981" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={korisnici}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={
            <RefreshControl
              refreshing={osvezava}
              onRefresh={() => {
                setOsvezava(true);
                ucitajKorisnike();
              }}
              tintColor="#10B981"
            />
          }
          contentContainerStyle={{ padding: 16, width: '100%', maxWidth: 760, alignSelf: 'center' }}
          renderItem={({ item }) => {
            const imaPretplatu =
              item.token_active === 1 &&
              item.token_expires_at &&
              new Date(item.token_expires_at) > new Date();
            const jeBlokiran = Number(item.is_active) === 0;

            return (
              <View style={[styles.userCard, jeBlokiran && styles.userCardBlokiran]}>
                <View style={styles.userHeader}>
                  <View>
                    <Text style={styles.userName}>
                      {item.ime ? `${item.ime} (${item.korisnicko_ime})` : item.korisnicko_ime}
                    </Text>
                    <Text style={styles.userRole}>Rola: {item.rola.toUpperCase()}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {jeBlokiran && (
                      <View style={[styles.statusBadge, { backgroundColor: '#7F1D1D', borderColor: '#EF4444', borderWidth: 1 }]}>
                        <Text style={styles.statusBadgeTekst}>⛔ BLOKIRAN</Text>
                      </View>
                    )}
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: imaPretplatu ? '#065F46' : '#3F3F46' }
                      ]}
                    >
                      <Text style={styles.statusBadgeTekst}>
                        {imaPretplatu ? 'AKTIVAN TOKEN' : 'BEZ PRETPLATE'}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoTekst}>
                    Iskorišćeno besplatnih: <Text style={{ color: '#fff' }}>{item.besplatni_unosi_iskorisceno}/10</Text>
                  </Text>
                  <Text style={styles.infoTekst}>
                    Ukupno unosa u bazi: <Text style={{ color: '#fff' }}>{item.ukupno_podsetnika}</Text>
                  </Text>
                </View>

                <View style={styles.datumRow}>
                  <Text style={styles.datumLabel}>Važi do:</Text>
                  <Text style={styles.datumVrednost}>
                    {item.token_expires_at
                      ? new Date(item.token_expires_at).toLocaleDateString('sr-RS', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })
                      : 'Nema definisan datum'}
                  </Text>
                </View>

                <View style={styles.akcijeRow}>
                  {/* Taster za otvaranje kalendara */}
                  <TouchableOpacity
                    style={styles.btnKalendar}
                    onPress={() => otvoriKalendarZaKorisnika(item)}
                  >
                    <Text style={styles.btnKalendarTekst}>📅 Podesi datum</Text>
                  </TouchableOpacity>

                  {item.id !== 1 && (
                    <TouchableOpacity
                      style={[
                        styles.btnBlokiraj,
                        { backgroundColor: jeBlokiran ? '#2563EB' : '#DC2626' }
                      ]}
                      onPress={() => promeniStatusNaloga(item.id, item.is_active)}
                    >
                      <Text style={styles.btnBlokirajTekst}>
                        {jeBlokiran ? '✅ Odblokiraj' : '⛔ Blokiraj'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}

      {/* MODAL: MODERAN KALENDAR ZA ODABIR DATUMA */}
      {kalendarOtvoren && (
        <View style={[StyleSheet.absoluteFill, styles.modalOverlay, { zIndex: 9999 }]}>
            <View style={styles.kalendarKontejner}>
              {/* Naslov modala */}
              <View style={styles.kalendarHeader}>
                <View>
                  <Text style={styles.kalendarNaslov}>📅 Podešavanje licence</Text>
                  <Text style={styles.kalendarKorisnik}>
                    Korisnik: <Text style={{ color: '#10B981', fontWeight: 'bold' }}>{izabraniKorisnik?.korisnicko_ime}</Text>
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setKalendarOtvoren(false)}>
                  <Text style={styles.modalZatvori}>✕</Text>
                </TouchableOpacity>
              </View>

            {/* Brzi izbor (15., 20., kraj meseca, +30 dana) */}
            <Text style={styles.brziNaslov}>Brzi skok na datum:</Text>
            <View style={styles.brziDugmadRow}>
              <TouchableOpacity style={styles.btnBrzi} onPress={() => postaviBrziDatum('15')}>
                <Text style={styles.btnBrziTekst}>Do 15-og</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnBrzi} onPress={() => postaviBrziDatum('20')}>
                <Text style={styles.btnBrziTekst}>Do 20-og</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnBrzi} onPress={() => postaviBrziDatum('kraj')}>
                <Text style={styles.btnBrziTekst}>Kraj meseca</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnBrzi} onPress={() => postaviBrziDatum('30dana')}>
                <Text style={styles.btnBrziTekst}>+30 Dana</Text>
              </TouchableOpacity>
            </View>

            {/* Mesec & Godina navigator */}
            <View style={styles.mesecNavigator}>
              <TouchableOpacity style={styles.navStrelica} onPress={() => promeniMesec(-1)}>
                <Text style={styles.navStrelicaTekst}>◀</Text>
              </TouchableOpacity>
              <Text style={styles.mesecGodinaTekst}>
                {MESECI[prikazaniMesec]} {prikazanaGodina}.
              </Text>
              <TouchableOpacity style={styles.navStrelica} onPress={() => promeniMesec(1)}>
                <Text style={styles.navStrelicaTekst}>▶</Text>
              </TouchableOpacity>
            </View>

            {/* Dani u nedelji */}
            <View style={styles.daniNedeljeRow}>
              {DANI_NEDELJE.map((dan, idx) => (
                <Text key={idx} style={styles.danNedeljeTekst}>{dan}</Text>
              ))}
            </View>

            {/* Matrica dana */}
            <View style={styles.matricaDana}>
              {generisiDaneZaMesec().map((dan, idx) => {
                if (dan === null) {
                  return <View key={idx} style={styles.praznaCelija} />;
                }

                const jeIzabran =
                  izabraniDatum.getDate() === dan &&
                  izabraniDatum.getMonth() === prikazaniMesec &&
                  izabraniDatum.getFullYear() === prikazanaGodina;

                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.danCelija, jeIzabran && styles.danCelijaIzabrana]}
                    onPress={() => {
                      const novi = new Date(prikazanaGodina, prikazaniMesec, dan);
                      setIzabraniDatum(novi);
                    }}
                  >
                    <Text style={[styles.danTekst, jeIzabran && styles.danTekstIzabran]}>
                      {dan}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Prikaz izabranog datuma */}
            <View style={styles.izabranPrikazBox}>
              <Text style={styles.izabranPrikazLabel}>Licenca će važiti do:</Text>
              <Text style={styles.izabranPrikazDatum}>
                {izabraniDatum.toLocaleDateString('sr-RS', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })} (23:59h)
              </Text>
            </View>

            {/* Dugme za potvrdu */}
            <TouchableOpacity
              style={styles.btnPotvrdiDatum}
              onPress={sacuvajIzabraniDatum}
              disabled={saljeZahtev}
            >
              {saljeZahtev ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnPotvrdiDatumTekst}>✓ POTVRDI I AŽURIRAJ LICENCU</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  header: { padding: 18, borderBottomWidth: 1, borderColor: '#27272A', backgroundColor: '#18181B', width: '100%', maxWidth: 760, alignSelf: 'center' },
  btnNazad: { marginBottom: 10 },
  btnNazadTekst: { color: '#60A5FA', fontSize: 14, fontWeight: '600' },
  naslov: { fontSize: 22, fontWeight: '800', color: '#10B981' },
  podnaslov: { fontSize: 13, color: '#A1A1AA', marginTop: 2 },
  userCard: {
    backgroundColor: '#1E1E24',
    padding: 16,
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#2F2F3D'
  },
  userCardBlokiran: {
    borderColor: '#DC2626',
    borderWidth: 1.5,
    backgroundColor: '#1C1517'
  },
  userHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  userName: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
  userRole: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusBadgeTekst: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },
  infoRow: { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between' },
  infoTekst: { fontSize: 13, color: '#9CA3AF' },
  datumRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  datumLabel: { fontSize: 12, color: '#9CA3AF' },
  datumVrednost: { fontSize: 14, color: '#34D399', fontWeight: '800' },
  akcijeRow: { flexDirection: 'row', marginTop: 14, gap: 10 },
  btnKalendar: {
    flex: 2,
    backgroundColor: '#10B981',
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center'
  },
  btnKalendarTekst: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  btnBlokiraj: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center'
  },
  btnBlokirajTekst: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },

  // Stilovi za Kalendar Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 20 },
  kalendarKontejner: { backgroundColor: '#1A1A22', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#2E2E3E' },
  kalendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  kalendarNaslov: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  kalendarKorisnik: { color: '#A1A1AA', fontSize: 13, marginTop: 2 },
  modalZatvori: { color: '#71717A', fontSize: 22, fontWeight: 'bold' },
  brziNaslov: { color: '#9CA3AF', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 },
  brziDugmadRow: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  btnBrzi: { flex: 1, backgroundColor: '#272733', paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
  btnBrziTekst: { color: '#60A5FA', fontSize: 11, fontWeight: '700' },
  mesecNavigator: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  navStrelica: { backgroundColor: '#272733', width: 34, height: 34, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  navStrelicaTekst: { color: '#10B981', fontSize: 14, fontWeight: 'bold' },
  mesecGodinaTekst: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  daniNedeljeRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 8 },
  danNedeljeTekst: { color: '#71717A', fontSize: 12, fontWeight: '700', width: 36, textAlign: 'center' },
  matricaDana: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around' },
  praznaCelija: { width: 36, height: 36, margin: 2 },
  danCelija: { width: 36, height: 36, margin: 2, borderRadius: 18, justifyContent: 'center', alignItems: 'center', backgroundColor: '#22222E' },
  danCelijaIzabrana: { backgroundColor: '#10B981' },
  danTekst: { color: '#E4E4E7', fontSize: 13, fontWeight: '600' },
  danTekstIzabran: { color: '#FFFFFF', fontWeight: '900' },
  izabranPrikazBox: { backgroundColor: '#064E3B', padding: 12, borderRadius: 10, marginTop: 16, alignItems: 'center' },
  izabranPrikazLabel: { color: '#A7F3D0', fontSize: 11, fontWeight: '600' },
  izabranPrikazDatum: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', marginTop: 2 },
  btnPotvrdiDatum: { backgroundColor: '#10B981', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 14 },
  btnPotvrdiDatumTekst: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', letterSpacing: 0.5 }
});
