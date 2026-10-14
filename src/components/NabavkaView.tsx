import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LokalniPodsetnik } from '../services/storage';

interface NabavkaItem {
  id: string;
  opis: string;
  kolicina: string;
  posaoNaziv: string;
  klijentIme: string;
  lokacija: string;
  posaoUuid: string;
}

interface NabavkaViewProps {
  podsetnici: LokalniPodsetnik[];
  onOtvoriEdit: (posao: LokalniPodsetnik) => void;
  onDodajNovuNabavku: () => void;
}

const STORAGE_KEY_KUPLJENO = 'zapisito_kupljene_stavke_v2';

export default function NabavkaView({ podsetnici, onOtvoriEdit, onDodajNovuNabavku }: NabavkaViewProps) {
  const [kupljeneStavke, setKupljeneStavke] = useState<Record<string, boolean>>({});

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY_KUPLJENO).then(data => {
      if (data) {
        try {
          setKupljeneStavke(JSON.parse(data));
        } catch (e) {}
      }
    });
  }, []);

  const prebaciStatusStavke = async (id: string) => {
    const noviStatus = !kupljeneStavke[id];
    const azurirano = { ...kupljeneStavke, [id]: noviStatus };
    setKupljeneStavke(azurirano);
    await AsyncStorage.setItem(STORAGE_KEY_KUPLJENO, JSON.stringify(azurirano));
  };

  // Izdvajamo stavke iz poslova koji su tipa 'nabavka' ILI imaju stavke materijala u poslu
  const sveStavke: NabavkaItem[] = [];

  podsetnici
    .filter(p => !p.je_zavrseno)
    .forEach(posao => {
      if (posao.stavke && posao.stavke.length > 0) {
        posao.stavke.forEach((st, sIdx) => {
          sveStavke.push({
            id: `${posao.uuid_lokalni}_${sIdx}`,
            opis: st.opis,
            kolicina: st.kolicina || (st.iznos > 0 ? `${st.iznos} ${st.valuta}` : '1 kom'),
            posaoNaziv: posao.opis_zadatka || 'Nabavka',
            klijentIme: posao.klijent_ime || '',
            lokacija: posao.lokacija || '',
            posaoUuid: posao.uuid_lokalni
          });
        });
      } else if (posao.tip_zabelezke === 'nabavka') {
        sveStavke.push({
          id: `${posao.uuid_lokalni}_0`,
          opis: posao.opis_zadatka || 'Artikal za nabavku',
          kolicina: '1 kom',
          posaoNaziv: 'Lista za prodavnicu',
          klijentIme: posao.klijent_ime || '',
          lokacija: posao.lokacija || '',
          posaoUuid: posao.uuid_lokalni
        });
      }
    });

  const ukupanBroj = sveStavke.length;
  const kupljenoBroj = sveStavke.filter(s => kupljeneStavke[s.id]).length;
  const preostaloBroj = ukupanBroj - kupljenoBroj;

  const posaljiSpisakNaWhatsapp = () => {
    if (sveStavke.length === 0) return;

    let poruka = `🛒 *SPISAK ZA KUPOVINU - PRODAVNICA / STOVARIŠTE*\n`;
    poruka += `📅 Datum: ${new Date().toLocaleDateString('sr-RS')}\n`;
    poruka += `------------------------------\n`;

    sveStavke.forEach((s) => {
      const oznaka = kupljeneStavke[s.id] ? '✅ (KUPLJENO)' : '⬜';
      poruka += `${oznaka} *${s.opis}* - Količina: ${s.kolicina}${s.klijentIme ? ` [${s.klijentIme}]` : ''}\n`;
    });

    poruka += `------------------------------\n`;
    poruka += `Ukupno artikala: ${ukupanBroj} (Preostalo za kupovinu: ${preostaloBroj})\n`;

    const url = `https://wa.me/?text=${encodeURIComponent(poruka)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Info', 'Nije uspelo otvaranje WhatsApp-a.');
    });
  };

  if (sveStavke.length === 0) {
    return (
      <View style={styles.prazno}>
        <Text style={styles.praznoIkona}>🛒</Text>
        <Text style={styles.praznoNaslov}>Lista za kupovinu je prazna</Text>
        <Text style={styles.praznoTekst}>
          Izdiktirajte šta vam treba u prodavnici ili na stovarištu (npr. "3 džaka lepka, 2 kante polikolora, 50 tiplova").
        </Text>
        <TouchableOpacity style={styles.btnDodajPrazno} onPress={onDodajNovuNabavku}>
          <Text style={styles.btnDodajPraznoTekst}>🎙️ Izdiktiraj novu nabavku</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Statistika kartica */}
      <View style={styles.statKutija}>
        <View style={styles.statInfo}>
          <Text style={styles.statNaslov}>🛒 Korpa za stovarište i prodavnicu</Text>
          <Text style={styles.statPodnaslov}>
            Kupljeno: <Text style={{ color: '#10B981', fontWeight: '800' }}>{kupljenoBroj}</Text> od {ukupanBroj} artikala
            {preostaloBroj > 0 ? ` (još ${preostaloBroj} za kupovinu)` : ' 🎉 Sve je nabavljeno!'}
          </Text>
        </View>

        <TouchableOpacity style={styles.btnWhatsapp} onPress={posaljiSpisakNaWhatsapp}>
          <Text style={styles.btnWhatsappTekst}>💬 Pošalji spisak</Text>
        </TouchableOpacity>
      </View>

      {/* Lista stavki u stilu artikala u prodavnici */}
      <View style={styles.listaKontejner}>
        {sveStavke.map(st => {
          const jeKupljeno = !!kupljeneStavke[st.id];

          return (
            <View
              key={st.id}
              style={[styles.stavkaRed, jeKupljeno && styles.stavkaRedKupljeno]}
            >
              <TouchableOpacity
                style={styles.checkboxTouch}
                onPress={() => prebaciStatusStavke(st.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkboxKrug, jeKupljeno && styles.checkboxKrugAktivno]}>
                  {jeKupljeno && <Text style={styles.kvačica}>✓</Text>}
                </View>
              </TouchableOpacity>

              <View style={{ flex: 1, paddingVertical: 4 }}>
                <Text style={[styles.stavkaOpis, jeKupljeno && styles.stavkaOpisKupljeno]}>
                  {st.opis}
                </Text>
                <View style={styles.redKolicine}>
                  <Text style={styles.badgeKolicina}>📦 {st.kolicina}</Text>
                  {st.klijentIme ? (
                    <Text style={styles.badgeKlijent}>👤 {st.klijentIme}</Text>
                  ) : null}
                </View>
              </View>

              <TouchableOpacity
                style={styles.btnEdit}
                onPress={() => {
                  const roditelj = podsetnici.find(p => p.uuid_lokalni === st.posaoUuid);
                  if (roditelj) onOtvoriEdit(roditelj);
                }}
              >
                <Text style={styles.btnEditTekst}>✏️</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 110, maxWidth: 900, width: '100%', alignSelf: 'center' },
  prazno: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, marginTop: 60 },
  praznoIkona: { fontSize: 64, marginBottom: 16 },
  praznoNaslov: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', marginBottom: 8, textAlign: 'center' },
  praznoTekst: { fontSize: 14, color: '#A1A1AA', textAlign: 'center', lineHeight: 22, maxWidth: 440, marginBottom: 20 },
  btnDodajPrazno: { backgroundColor: '#10B981', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12 },
  btnDodajPraznoTekst: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  statKutija: {
    backgroundColor: '#1E1E24',
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2A35',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  statInfo: { flex: 1, paddingRight: 10 },
  statNaslov: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', marginBottom: 4 },
  statPodnaslov: { fontSize: 13, color: '#94A3B8' },
  btnWhatsapp: {
    backgroundColor: '#059669',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10
  },
  btnWhatsappTekst: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  listaKontejner: { gap: 10 },
  stavkaRed: {
    backgroundColor: '#18181B',
    padding: 14,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#27272A',
    gap: 12
  },
  stavkaRedKupljeno: {
    backgroundColor: '#121214',
    borderColor: '#1C1917',
    opacity: 0.65
  },
  checkboxTouch: { padding: 4 },
  checkboxKrug: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#52525B',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#27272A'
  },
  checkboxKrugAktivno: {
    backgroundColor: '#10B981',
    borderColor: '#10B981'
  },
  kvačica: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  stavkaOpis: { fontSize: 16, fontWeight: '700', color: '#F4F4F5' },
  stavkaOpisKupljeno: { textDecorationLine: 'line-through', color: '#71717A' },
  redKolicine: { flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  badgeKolicina: {
    backgroundColor: '#27272A',
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  badgeKlijent: {
    backgroundColor: '#27272A',
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  btnEdit: { padding: 8, borderRadius: 8, backgroundColor: '#27272A' },
  btnEditTekst: { fontSize: 16 }
});
