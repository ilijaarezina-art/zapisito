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
  iznos: number;
  valuta: string;
  posaoNaziv: string;
  klijentIme: string;
  lokacija: string;
}

interface NabavkaViewProps {
  podsetnici: LokalniPodsetnik[];
}

const STORAGE_KEY_KUPLJENO = 'zapisito_kupljene_stavke_v1';

export default function NabavkaView({ podsetnici }: NabavkaViewProps) {
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

  // Izdvajanje svih stavki iz aktivnih poslova
  const sveStavke: NabavkaItem[] = [];
  podsetnici
    .filter(p => !p.je_zavrseno)
    .forEach((posao, pIdx) => {
      if (posao.stavke && posao.stavke.length > 0) {
        posao.stavke.forEach((st, sIdx) => {
          sveStavke.push({
            id: `${posao.uuid_lokalni}_${sIdx}`,
            opis: st.opis,
            iznos: st.iznos,
            valuta: st.valuta,
            posaoNaziv: posao.opis_zadatka || 'Posao',
            klijentIme: posao.klijent_ime || 'Klijent',
            lokacija: posao.lokacija || ''
          });
        });
      }
    });

  const ukupanBroj = sveStavke.length;
  const kupljenoBroj = sveStavke.filter(s => kupljeneStavke[s.id]).length;
  const preostaloBroj = ukupanBroj - kupljenoBroj;

  const ukupnaVrednost = sveStavke.reduce((sum, s) => sum + s.iznos, 0);

  const posaljiSpisakNaWhatsapp = () => {
    if (sveStavke.length === 0) return;

    let poruka = `🛒 *SPISAK ZA NABAVKU MATERIJALA*\n`;
    poruka += `📅 Datum: ${new Date().toLocaleDateString('sr-RS')}\n`;
    poruka += `------------------------------\n`;

    sveStavke.forEach((s, i) => {
      const oznaka = kupljeneStavke[s.id] ? '✅' : '⬜';
      poruka += `${oznaka} ${s.opis} (${s.klijentIme}${s.lokacija ? ` - ${s.lokacija}` : ''})\n`;
    });

    poruka += `------------------------------\n`;
    poruka += `Ukupno stavki: ${ukupanBroj} (Preostalo: ${preostaloBroj})\n`;

    const url = `https://wa.me/?text=${encodeURIComponent(poruka)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Info', 'Nije uspelo otvaranje WhatsApp-a.');
    });
  };

  if (sveStavke.length === 0) {
    return (
      <View style={styles.prazno}>
        <Text style={styles.praznoIkona}>🛒</Text>
        <Text style={styles.praznoNaslov}>Nemate materijala za nabavku</Text>
        <Text style={styles.praznoTekst}>
          Kada izdiktirate posao sa specifikacijom (npr. "cement 20 džakova, šljunak 4 kubika"), aplikacija automatski kreira vašu šoping listu za stovarište ovde!
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Statistika kartica */}
      <View style={styles.statKutija}>
        <View style={styles.statInfo}>
          <Text style={styles.statNaslov}>Spisak za stovarište / prodavnicu</Text>
          <Text style={styles.statPodnaslov}>
            Kupljeno: <Text style={{ color: '#34D399', fontWeight: '800' }}>{kupljenoBroj}</Text> od {ukupanBroj} stavki
            {preostaloBroj > 0 ? ` (još ${preostaloBroj} za kupovinu)` : ' 🎉 Sve je nabavljeno!'}
          </Text>
        </View>

        <TouchableOpacity style={styles.btnWhatsapp} onPress={posaljiSpisakNaWhatsapp}>
          <Text style={styles.btnWhatsappTekst}>💬 Pošalji spisak</Text>
        </TouchableOpacity>
      </View>

      {/* Lista stavki */}
      <View style={styles.listaKontejner}>
        {sveStavke.map(st => {
          const jeKupljeno = !!kupljeneStavke[st.id];

          return (
            <TouchableOpacity
              key={st.id}
              style={[styles.stavkaRed, jeKupljeno && styles.stavkaRedKupljeno]}
              onPress={() => prebaciStatusStavke(st.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.checkboxIkona}>{jeKupljeno ? '✅' : '⬜'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.stavkaOpis, jeKupljeno && styles.stavkaOpisKupljeno]}>
                  {st.opis}
                </Text>
                <Text style={styles.stavkaPodaci}>
                  Za: {st.klijentIme} {st.lokacija ? `(${st.lokacija})` : ''}
                </Text>
              </View>
              {st.iznos > 0 && (
                <Text style={[styles.stavkaCena, jeKupljeno && styles.stavkaCenaKupljeno]}>
                  {st.iznos.toLocaleString('sr-RS')} {st.valuta}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 110,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center'
  },
  statKutija: {
    backgroundColor: '#181824',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2F2F42',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 12
  },
  statInfo: {
    flex: 1,
    minWidth: 200
  },
  statNaslov: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800'
  },
  statPodnaslov: {
    color: '#A1A1AA',
    fontSize: 13,
    marginTop: 4
  },
  btnWhatsapp: {
    backgroundColor: '#25D366',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10
  },
  btnWhatsappTekst: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '800'
  },
  listaKontejner: {
    backgroundColor: '#14141C',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#262636',
    overflow: 'hidden'
  },
  stavkaRed: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderColor: '#222230',
    gap: 12
  },
  stavkaRedKupljeno: {
    backgroundColor: '#0F1A15',
    opacity: 0.75
  },
  checkboxIkona: {
    fontSize: 20
  },
  stavkaOpis: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700'
  },
  stavkaOpisKupljeno: {
    color: '#9CA3AF',
    textDecorationLine: 'line-through'
  },
  stavkaPodaci: {
    color: '#71717A',
    fontSize: 12,
    marginTop: 3
  },
  stavkaCena: {
    color: '#34D399',
    fontSize: 14,
    fontWeight: '800'
  },
  stavkaCenaKupljeno: {
    color: '#6EE7B7',
    textDecorationLine: 'line-through'
  },
  prazno: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center'
  },
  praznoIkona: {
    fontSize: 48,
    marginBottom: 16
  },
  praznoNaslov: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center'
  },
  praznoTekst: {
    color: '#71717A',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center'
  }
});
