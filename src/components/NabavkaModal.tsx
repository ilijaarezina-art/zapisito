import React, { useState } from 'react';
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

interface NabavkaModalProps {
  vidljiv: boolean;
  nabavka: LokalniPodsetnik | null;
  onZatvori: () => void;
  onSacuvaj: (azuriran: LokalniPodsetnik) => Promise<void>;
}

export default function NabavkaModal({
  vidljiv,
  nabavka,
  onZatvori,
  onSacuvaj
}: NabavkaModalProps) {
  if (!vidljiv || !nabavka) return null;

  const [naslov, setNaslov] = useState(nabavka.naslov || 'Lista za nabavku');
  const [stavke, setStavke] = useState<StavkaSpecifikacije[]>(() => {
    if (nabavka.stavke && nabavka.stavke.length > 0) {
      return nabavka.stavke.map((st, i) => ({
        ...st,
        br: i + 1,
        opis: st.opis || '',
        kolicina: st.kolicina || '1 kom',
        iznos: st.iznos || 0,
        valuta: st.valuta || 'RSD',
        kupljeno: !!st.kupljeno
      }));
    }
    return [
      { br: 1, opis: 'Jabuke', kolicina: '2 kg', iznos: 0, valuta: 'RSD', kupljeno: false },
      { br: 2, opis: 'Banane', kolicina: '1 kg', iznos: 0, valuta: 'RSD', kupljeno: false },
      { br: 3, opis: 'Kafa', kolicina: '200 gr', iznos: 0, valuta: 'RSD', kupljeno: false }
    ];
  });

  const [cuva, setCuva] = useState(false);

  const prebaciKupljeno = (index: number) => {
    const kopija = [...stavke];
    kopija[index].kupljeno = !kopija[index].kupljeno;
    setStavke(kopija);
  };

  const izmeniStavku = (index: number, polje: 'opis' | 'kolicina' | 'iznos', vrednost: string) => {
    const kopija = [...stavke];
    if (polje === 'iznos') {
      kopija[index].iznos = parseFloat(vrednost.replace(',', '.')) || 0;
    } else {
      kopija[index][polje] = vrednost;
    }
    setStavke(kopija);
  };

  const obrisiStavku = (index: number) => {
    const nova = stavke.filter((_, i) => i !== index).map((s, idx) => ({ ...s, br: idx + 1 }));
    setStavke(nova);
  };

  const dodajStavku = () => {
    const nova: StavkaSpecifikacije = {
      br: stavke.length + 1,
      opis: '',
      kolicina: '1 kom',
      iznos: 0,
      valuta: 'RSD',
      kupljeno: false
    };
    setStavke([...stavke, nova]);
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

    stavke.forEach((s) => {
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
        {/* Zaglavlje */}
        <View style={styles.modalHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.dokumentNadnaslov}>DOKUMENT: LISTA ZA NABAVKU</Text>
            <Text style={styles.dokumentDatum}>
              Kreirano: {new Date(nabavka.kreirano_na_uredjaju).toLocaleDateString('sr-RS')} ({kupljenoUkupno}/{stavke.length} kupljeno)
            </Text>
          </View>
          <TouchableOpacity style={styles.btnZatvori} onPress={onZatvori}>
            <Text style={styles.btnZatvoriTekst}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollSadrzaj}>
          {/* Beli list papira - Identican tabeli sa Slike 2 */}
          <View style={styles.beliList}>
            {/* Naziv liste */}
            <TextInput
              style={styles.naslovListeInput}
              value={naslov}
              onChangeText={setNaslov}
              placeholder="Naziv liste (npr. Nabavka za kuću / Namirnice)..."
              placeholderTextColor="#94A3B8"
            />

            {/* TABELA: ✓ | Namirnica | Količina | Cena (procena) | 🗑️ */}
            <View style={styles.tabelaHeader}>
              <Text style={[styles.headerCol, { width: 44, textAlign: 'center' }]}>✓</Text>
              <Text style={[styles.headerCol, { flex: 2 }]}>Namirnica</Text>
              <Text style={[styles.headerCol, { flex: 1.2 }]}>Količina</Text>
              <Text style={[styles.headerCol, { flex: 1.3 }]}>Cena (procena)</Text>
              <Text style={[styles.headerCol, { width: 40, textAlign: 'center' }]}>Briši</Text>
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
                  onChangeText={(val) => izmeniStavku(idx, 'opis', val)}
                  placeholder="Namirnica / Artikal..."
                  placeholderTextColor="#94A3B8"
                />

                {/* Količina (npr 2 kg, 1 kom, 200 gr...) */}
                <TextInput
                  style={[
                    styles.inputPolje,
                    { flex: 1.2 },
                    st.kupljeno && styles.tekstPrecrtan
                  ]}
                  value={String(st.kolicina || '')}
                  onChangeText={(val) => izmeniStavku(idx, 'kolicina', val)}
                  placeholder="2 kg, 1 kom..."
                  placeholderTextColor="#94A3B8"
                />

                {/* Cena (procena) */}
                <TextInput
                  style={[
                    styles.inputPolje,
                    { flex: 1.3 },
                    st.kupljeno && styles.tekstPrecrtan
                  ]}
                  value={st.iznos && st.iznos > 0 ? String(st.iznos) : ''}
                  keyboardType="numeric"
                  onChangeText={(val) => izmeniStavku(idx, 'iznos', val)}
                  placeholder="RSD..."
                  placeholderTextColor="#94A3B8"
                />

                {/* KORPA ZA BRISANJE STAVKE (Obavezno po zahtevu korisnika) */}
                <TouchableOpacity
                  style={styles.btnBrisi}
                  onPress={() => obrisiStavku(idx)}
                >
                  <Text style={styles.btnBrisiTekst}>🗑️</Text>
                </TouchableOpacity>
              </View>
            ))}

            {/* Dugme za dodavanje novog reda */}
            <TouchableOpacity style={styles.btnDodajRed} onPress={dodajStavku}>
              <Text style={styles.btnDodajRedTekst}>+ Dodaj novu stavku na spisak</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Footer sa akcijama */}
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
              <ActivityIndicator color="#0F172A" size="small" />
            ) : (
              <Text style={styles.btnSacuvajTekst}>💾 Sačuvaj izmene</Text>
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
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    elevation: 25,
    padding: Platform.OS === 'web' ? 20 : 8
  },
  prozorKontejner: {
    width: '100%',
    maxWidth: 720,
    maxHeight: '94%',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
    flexDirection: 'column'
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#334155'
  },
  dokumentNadnaslov: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1
  },
  dokumentDatum: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2
  },
  btnZatvori: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center'
  },
  btnZatvoriTekst: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold'
  },
  scrollSadrzaj: {
    padding: Platform.OS === 'web' ? 16 : 8
  },
  beliList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: Platform.OS === 'web' ? 24 : 14,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3
  },
  naslovListeInput: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    borderBottomWidth: 2,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 8,
    marginBottom: 16
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
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
    paddingHorizontal: 4
  },
  tabelaRed: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingVertical: 6
  },
  tabelaRedParan: {
    backgroundColor: '#F8FAFC'
  },
  tabelaRedKupljeno: {
    backgroundColor: '#F0FDF4'
  },
  checkboxTouch: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4
  },
  checkboxKocka: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#64748B',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center'
  },
  checkboxKockaCekirana: {
    backgroundColor: '#10B981',
    borderColor: '#10B981'
  },
  checkboxKvacica: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900'
  },
  inputPolje: {
    fontSize: 14,
    color: '#0F172A',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 4,
    marginHorizontal: 3,
    backgroundColor: '#FFFFFF'
  },
  tekstPrecrtan: {
    textDecorationLine: 'line-through',
    color: '#94A3B8'
  },
  btnBrisi: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6
  },
  btnBrisiTekst: {
    fontSize: 16
  },
  btnDodajRed: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1'
  },
  btnDodajRedTekst: {
    fontSize: 13,
    fontWeight: '700',
    color: '#10B981'
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 14,
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: '#334155',
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
    flex: 1.5,
    paddingVertical: 12,
    backgroundColor: '#F59E0B',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnSacuvajTekst: {
    color: '#0F172A',
    fontWeight: '900',
    fontSize: 14
  }
});
