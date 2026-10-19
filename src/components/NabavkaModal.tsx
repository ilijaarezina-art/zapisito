import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
  Linking
} from 'react-native';
import { LokalniPodsetnik, StavkaSpecifikacije } from '../services/storage';
import { parsirajTekst } from '../services/parser';

interface NabavkaModalProps {
  vidljiv: boolean;
  nabavka: LokalniPodsetnik | null;
  onZatvori: () => void;
  onSacuvaj: (azuriran: LokalniPodsetnik) => Promise<void>;
}

const CESTE_NAMIRNICE = [
  { opis: 'Hleb', kolicina: '1 kom' },
  { opis: 'Mleko', kolicina: '1 l' },
  { opis: 'Jaja', kolicina: '10 kom' },
  { opis: 'Kafa', kolicina: '200 gr' },
  { opis: 'Šećer', kolicina: '1 kg' },
  { opis: 'Ulje', kolicina: '1 l' },
  { opis: 'Jabuke', kolicina: '2 kg' },
  { opis: 'Banane', kolicina: '1 kg' },
  { opis: 'Krompir', kolicina: '3 kg' },
  { opis: 'Sir', kolicina: '500 gr' },
  { opis: 'Meso', kolicina: '1 kg' },
  { opis: 'Kisela voda', kolicina: '1 paket' }
];

export default function NabavkaModal({
  vidljiv,
  nabavka,
  onZatvori,
  onSacuvaj
}: NabavkaModalProps) {
  if (!vidljiv || !nabavka) return null;

  const dobaviInicijalneStavke = (nab: LokalniPodsetnik): StavkaSpecifikacije[] => {
    if (nab.stavke && Array.isArray(nab.stavke) && nab.stavke.length > 0) {
      return nab.stavke.map((st, i) => ({
        ...st,
        id: st.id || `st_${Date.now()}_${i}`,
        br: i + 1,
        opis: st.opis || '',
        kolicina: st.kolicina || '1 kom',
        iznos: st.iznos || 0,
        valuta: st.valuta || 'RSD',
        kupljeno: !!st.kupljeno
      }));
    }
    // Ako nema sačuvanih stavki, automatski ih parsiraj iz sirovog izgovorenog teksta
    const tekst = nab.sirovi_tekst || nab.opis_zadatka || '';
    if (tekst.trim()) {
      const parsed = parsirajTekst(tekst, 'nabavka');
      if (parsed.stavke && parsed.stavke.length > 0) {
        return parsed.stavke;
      }
    }
    return [];
  };

  const [naslov, setNaslov] = useState(
    nabavka.naslov &&
      !nabavka.naslov.includes('Građevinsk') &&
      !nabavka.naslov.includes('Specifikacija')
      ? nabavka.naslov
      : 'Lista za nabavku'
  );

  const [stavke, setStavke] = useState<StavkaSpecifikacije[]>(() => dobaviInicijalneStavke(nabavka));
  const [novaNamirnica, setNovaNamirnica] = useState('');
  const [cuva, setCuva] = useState(false);

  // Sinhronizacija kada se otvori drugi unos
  useEffect(() => {
    if (nabavka) {
      setNaslov(
        nabavka.naslov &&
          !nabavka.naslov.includes('Građevinsk') &&
          !nabavka.naslov.includes('Specifikacija')
          ? nabavka.naslov
          : 'Lista za nabavku'
      );
      setStavke(dobaviInicijalneStavke(nabavka));
      setNovaNamirnica('');
    }
  }, [nabavka?.uuid_lokalni]);

  const prebaciKupljeno = (index: number) => {
    setStavke(prev => {
      const kopija = [...prev];
      if (kopija[index]) {
        kopija[index] = { ...kopija[index], kupljeno: !kopija[index].kupljeno };
      }
      return kopija;
    });
  };

  const izmeniStavku = (index: number, polje: 'opis' | 'kolicina' | 'iznos', vrednost: string) => {
    setStavke(prev => {
      const kopija = [...prev];
      if (!kopija[index]) return prev;
      if (polje === 'iznos') {
        kopija[index] = { ...kopija[index], iznos: parseFloat(vrednost.replace(',', '.')) || 0 };
      } else {
        kopija[index] = { ...kopija[index], [polje]: vrednost };
      }
      return kopija;
    });
  };

  const obrisiStavku = (index: number) => {
    setStavke(prev => prev.filter((_, i) => i !== index).map((s, idx) => ({ ...s, br: idx + 1 })));
  };

  const dodajStavku = () => {
    const nova: StavkaSpecifikacije = {
      id: `item_${Date.now()}_${stavke.length}`,
      br: stavke.length + 1,
      opis: '',
      kolicina: '1 kom',
      iznos: 0,
      valuta: 'RSD',
      kupljeno: false
    };
    setStavke(prev => [...prev, nova]);
  };

  const dodajBrzuNamirnicu = (artikal: { opis: string; kolicina: string }) => {
    const nova: StavkaSpecifikacije = {
      id: `item_${Date.now()}_${stavke.length}`,
      br: stavke.length + 1,
      opis: artikal.opis,
      kolicina: artikal.kolicina,
      iznos: 0,
      valuta: 'RSD',
      kupljeno: false
    };
    setStavke(prev => [...prev, nova]);
  };

  const dodajIzInputa = () => {
    if (!novaNamirnica.trim()) return;
    const parsed = parsirajTekst(novaNamirnica.trim(), 'nabavka');
    if (parsed.stavke && parsed.stavke.length > 0) {
      setStavke(prev => [...prev, ...parsed.stavke!].map((s, idx) => ({ ...s, br: idx + 1 })));
    } else {
      const nova: StavkaSpecifikacije = {
        id: `item_${Date.now()}_${stavke.length}`,
        br: stavke.length + 1,
        opis: novaNamirnica.trim().charAt(0).toUpperCase() + novaNamirnica.trim().slice(1),
        kolicina: '1 kom',
        iznos: 0,
        valuta: 'RSD',
        kupljeno: false
      };
      setStavke(prev => [...prev, nova]);
    }
    setNovaNamirnica('');
  };

  // Uklanjanje kupljenih stavki
  const ocistiKupljene = () => {
    const kupljeneBr = stavke.filter(s => s.kupljeno).length;
    if (kupljeneBr === 0) {
      if (Platform.OS === 'web') {
        window.alert('Nema označenih kupljenih stavki za čišćenje.');
      } else {
        Alert.alert('Info', 'Nema označenih kupljenih stavki za čišćenje.');
      }
      return;
    }

    const izvrsiCiscenje = () => {
      setStavke(prev => prev.filter(s => !s.kupljeno).map((s, idx) => ({ ...s, br: idx + 1 })));
    };

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
        if (window.confirm(`Da li želite da uklonite ${kupljeneBr} kupljenih stavki sa spiska?`)) {
          izvrsiCiscenje();
        }
      } else {
        izvrsiCiscenje();
      }
    } else {
      Alert.alert(
        'Ukloni kupljene',
        `Da li želite da uklonite ${kupljeneBr} kupljenih stavki sa spiska?`,
        [
          { text: 'Odustani', style: 'cancel' },
          { text: 'Ukloni', style: 'destructive', onPress: izvrsiCiscenje }
        ]
      );
    }
  };

  const potvrdiISacuvaj = async () => {
    setCuva(true);
    try {
      const azuriran: LokalniPodsetnik = {
        ...nabavka,
        naslov: naslov.trim() || 'Lista za nabavku',
        stavke,
        opis_zadatka: `Lista: ${stavke.map(s => `${s.opis} (${s.kolicina})`).slice(0, 4).join(', ')}${stavke.length > 4 ? '...' : ''}`,
        tip_zabelezke: 'nabavka'
      };

      await onSacuvaj(azuriran);
      onZatvori();
    } catch (e: any) {
      Alert.alert('Greška', e.message || 'Nije uspelo čuvanje.');
    } finally {
      setCuva(false);
    }
  };

  const podeliNaWhatsApp = () => {
    if (stavke.length === 0) return;
    let tekst = `🛒 *${naslov.toUpperCase()}*\n`;
    tekst += `📅 ${new Date().toLocaleDateString('sr-RS')}\n`;
    tekst += `--------------------------------\n`;

    stavke.forEach(s => {
      const status = s.kupljeno ? '✅' : '⬜';
      const cenaStr = s.iznos && s.iznos > 0 ? ` (~${s.iznos} RSD)` : '';
      tekst += `${status} *${s.opis}* - ${s.kolicina}${cenaStr}\n`;
    });

    const kupljenoBr = stavke.filter(s => s.kupljeno).length;
    tekst += `--------------------------------\n`;
    tekst += `Stanje: ${kupljenoBr} od ${stavke.length} kupljeno\n`;

    const url = `https://wa.me/?text=${encodeURIComponent(tekst)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Info', 'Nije uspelo otvaranje WhatsApp-a.');
    });
  };

  const kupljenoUkupno = stavke.filter(s => s.kupljeno).length;

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.prozorKontejner}>
        {/* Zaglavlje - Moderni svetli stil */}
        <View style={styles.modalHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.dokumentNadnaslov}>🛒 LISTA ZA NABAVKU / KUPOVINU</Text>
            <Text style={styles.dokumentDatum}>
              Kreirano: {new Date(nabavka.kreirano_na_uredjaju).toLocaleDateString('sr-RS')} • {kupljenoUkupno}/{stavke.length} kupljeno
            </Text>
          </View>
          <TouchableOpacity style={styles.btnZatvori} onPress={onZatvori}>
            <Text style={styles.btnZatvoriTekst}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollSadrzaj}>
          {/* Beli list papira sa tabelom */}
          <View style={styles.beliList}>
            {/* Naziv liste */}
            <TextInput
              style={styles.naslovListeInput}
              value={naslov}
              onChangeText={setNaslov}
              placeholder="Naziv liste (npr. Nabavka za kuću / Namirnice)..."
              placeholderTextColor="#94A3B8"
            />

            {/* Brzi unos namirnice */}
            <View style={styles.brziUnosRed}>
              <TextInput
                style={styles.brziUnosInput}
                placeholder="Dodaj novu stavku (npr. Maslinovo ulje 1l)..."
                placeholderTextColor="#94A3B8"
                value={novaNamirnica}
                onChangeText={setNovaNamirnica}
                onSubmitEditing={dodajIzInputa}
              />
              <TouchableOpacity style={styles.btnBrzoDodaj} onPress={dodajIzInputa}>
                <Text style={styles.btnBrzoDodajTekst}>+ Dodaj</Text>
              </TouchableOpacity>
            </View>

            {/* Čipovi za česte namirnice (Bring! stil) */}
            <Text style={styles.cesteLabel}>⚡ Brzi izbor namirnica jednim klikom:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cesteScroll}>
              {CESTE_NAMIRNICE.map((item, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.cipNamirnica}
                  onPress={() => dodajBrzuNamirnicu(item)}
                >
                  <Text style={styles.cipNamirnicaTekst}>+ {item.opis}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* TABELA: ✓ | Namirnica | Količina | Cena (procena) | 🗑️ */}
            <View style={styles.tabelaHeader}>
              <Text style={[styles.headerCol, { width: 38, textAlign: 'center' }]}>✓</Text>
              <Text style={[styles.headerCol, { flex: 2 }]}>Namirnica</Text>
              <Text style={[styles.headerCol, { flex: 1.1 }]}>Količina</Text>
              <Text style={[styles.headerCol, { flex: 1.1 }]}>Cena (okv.)</Text>
              <Text style={[styles.headerCol, { width: 36, textAlign: 'center' }]}>Briši</Text>
            </View>

            {stavke.map((st, idx) => (
              <View
                key={st.id || idx}
                style={[
                  styles.tabelaRed,
                  st.kupljeno && styles.tabelaRedKupljeno,
                  idx % 2 === 1 && !st.kupljeno && styles.tabelaRedParan
                ]}
              >
                {/* Checkbox kolona */}
                <TouchableOpacity
                  style={styles.checkboxTouch}
                  onPress={() => prebaciKupljeno(idx)}
                >
                  <View style={[styles.checkboxKocka, st.kupljeno && styles.checkboxKockaCekirana]}>
                    {st.kupljeno && <Text style={styles.checkboxKvacica}>✓</Text>}
                  </View>
                </TouchableOpacity>

                {/* Namirnica / Artikal */}
                <TextInput
                  style={[
                    styles.inputPolje,
                    { flex: 2 },
                    st.kupljeno && styles.tekstPrecrtan
                  ]}
                  value={st.opis}
                  onChangeText={val => izmeniStavku(idx, 'opis', val)}
                  placeholder="Namirnica / Artikal..."
                  placeholderTextColor="#94A3B8"
                />

                {/* Količina */}
                <TextInput
                  style={[
                    styles.inputPolje,
                    { flex: 1.1 },
                    st.kupljeno && styles.tekstPrecrtan
                  ]}
                  value={String(st.kolicina || '')}
                  onChangeText={val => izmeniStavku(idx, 'kolicina', val)}
                  placeholder="2 kg, 1 kom..."
                  placeholderTextColor="#94A3B8"
                />

                {/* Cena (procena) */}
                <TextInput
                  style={[
                    styles.inputPolje,
                    { flex: 1.1 },
                    st.kupljeno && styles.tekstPrecrtan
                  ]}
                  value={st.iznos && st.iznos > 0 ? String(st.iznos) : ''}
                  keyboardType="numeric"
                  onChangeText={val => izmeniStavku(idx, 'iznos', val)}
                  placeholder="RSD..."
                  placeholderTextColor="#94A3B8"
                />

                {/* KORPA ZA BRISANJE STAVKE */}
                <TouchableOpacity
                  style={styles.btnBrisi}
                  onPress={() => obrisiStavku(idx)}
                >
                  <Text style={styles.btnBrisiTekst}>🗑️</Text>
                </TouchableOpacity>
              </View>
            ))}

            {/* Dugmad ispod tabele: Dodaj novi red + Očisti kupljene */}
            <View style={styles.akcijeIspodTabele}>
              <TouchableOpacity style={styles.btnDodajRed} onPress={dodajStavku}>
                <Text style={styles.btnDodajRedTekst}>+ Dodaj prazan red</Text>
              </TouchableOpacity>

              {kupljenoUkupno > 0 && (
                <TouchableOpacity style={styles.btnOcistiKupljene} onPress={ocistiKupljene}>
                  <Text style={styles.btnOcistiKupljeneTekst}>🧹 Očisti kupljene ({kupljenoUkupno})</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </ScrollView>

        {/* Footer sa akcijama - Moderan svetao stil */}
        <View style={styles.modalFooter}>
          <TouchableOpacity
            style={styles.btnPodeliWhatsApp}
            onPress={podeliNaWhatsApp}
          >
            <Text style={styles.btnPodeliWhatsAppTekst}>💬 Pošalji na WhatsApp</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnSacuvaj}
            onPress={potvrdiISacuvaj}
            disabled={cuva}
          >
            {cuva ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.btnSacuvajTekst}>✓ SAČUVAJ IZMENE</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Platform.OS === 'web' ? 20 : 10,
    zIndex: 9999
  },
  prozorKontejner: {
    width: '100%',
    maxWidth: 780,
    maxHeight: '92%',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'column',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0'
  },
  dokumentNadnaslov: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  dokumentDatum: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2
  },
  btnZatvori: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center'
  },
  btnZatvoriTekst: {
    color: '#475569',
    fontSize: 16,
    fontWeight: 'bold'
  },
  scrollSadrzaj: {
    padding: Platform.OS === 'web' ? 16 : 10
  },
  beliList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: Platform.OS === 'web' ? 24 : 14,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  naslovListeInput: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    borderBottomWidth: 2,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 8,
    marginBottom: 14
  },
  brziUnosRed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12
  },
  brziUnosInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#0F172A'
  },
  btnBrzoDodaj: {
    height: 40,
    paddingHorizontal: 14,
    backgroundColor: '#0284C7',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center'
  },
  btnBrzoDodajTekst: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13
  },
  cesteLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 6
  },
  cesteScroll: {
    marginBottom: 14
  },
  cipNamirnica: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    marginRight: 6
  },
  cipNamirnicaTekst: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600'
  },
  tabelaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#CBD5E1',
    paddingBottom: 8,
    marginBottom: 4
  },
  headerCol: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
    paddingHorizontal: 4
  },
  tabelaRed: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingVertical: 5
  },
  tabelaRedParan: {
    backgroundColor: '#F8FAFC'
  },
  tabelaRedKupljeno: {
    backgroundColor: '#F0FDF4'
  },
  checkboxTouch: {
    width: 38,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4
  },
  checkboxKocka: {
    width: 20,
    height: 20,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center'
  },
  checkboxKockaCekirana: {
    backgroundColor: '#10B981',
    borderColor: '#10B981'
  },
  checkboxKvacica: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900'
  },
  inputPolje: {
    fontSize: 13,
    color: '#0F172A',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    marginHorizontal: 3,
    backgroundColor: '#FFFFFF'
  },
  tekstPrecrtan: {
    textDecorationLine: 'line-through',
    color: '#94A3B8'
  },
  btnBrisi: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4
  },
  btnBrisiTekst: {
    fontSize: 15
  },
  akcijeIspodTabele: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    gap: 10
  },
  btnDodajRed: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1'
  },
  btnDodajRedTekst: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7'
  },
  btnOcistiKupljene: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FEE2E2'
  },
  btnOcistiKupljeneTekst: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626'
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 12
  },
  btnPodeliWhatsApp: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#25D366',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnPodeliWhatsAppTekst: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13
  },
  btnSacuvaj: {
    flex: 1.4,
    paddingVertical: 12,
    backgroundColor: '#10B981',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnSacuvajTekst: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14
  }
});
