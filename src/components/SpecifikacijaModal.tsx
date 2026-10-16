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
  Alert
} from 'react-native';
import { LokalniPodsetnik, StavkaSpecifikacije, KorisnikCache } from '../services/storage';
import { PdfService } from '../services/pdfService';

interface SpecifikacijaModalProps {
  vidljiv: boolean;
  posao: LokalniPodsetnik | null;
  korisnik: KorisnikCache;
  onZatvori: () => void;
  onSacuvaj: (azuriran: LokalniPodsetnik) => Promise<void>;
}

export default function SpecifikacijaModal({
  vidljiv,
  posao,
  korisnik,
  onZatvori,
  onSacuvaj
}: SpecifikacijaModalProps) {
  if (!vidljiv || !posao) return null;

  const [naslov, setNaslov] = useState(posao.naslov || posao.opis_zadatka || 'Specifikacija građevinskog materijala');
  const [valuta, setValuta] = useState<'RSD' | 'EUR'>(posao.valuta || 'RSD');
  const [obracunajPdv, setObracunajPdv] = useState<boolean>(posao.obracunaj_pdv !== false);
  const [napomene, setNapomene] = useState(
    posao.napomene ||
    '• Cene su informativne i zavise od proizvođača, regiona i trenutka nabavke.\n• Količine uključuju rezervu od 5-10% za sečenje i lom.\n• Materijal mora imati atest i deklaraciju u skladu sa standardima.'
  );

  // Stavke tabele
  const [stavke, setStavke] = useState<StavkaSpecifikacije[]>(() => {
    if (posao.stavke && posao.stavke.length > 0) {
      return posao.stavke.map((st, i) => ({
        ...st,
        br: i + 1,
        jed_mere: st.jed_mere || 'kom',
        kolicina: st.kolicina || 1,
        jed_cena: st.jed_cena || (st.iznos || 0),
        iznos: st.iznos || ((Number(st.kolicina) || 1) * (Number(st.jed_cena) || 0))
      }));
    }
    return [
      {
        br: 1,
        opis: 'Keramička pločica, I klasa',
        jed_mere: 'm²',
        kolicina: 10,
        jed_cena: 2000,
        iznos: 20000,
        valuta: posao.valuta || 'RSD'
      }
    ];
  });

  const [cuva, setCuva] = useState(false);
  const [deliPdf, setDeliPdf] = useState(false);

  // Proračuni
  const ukupnoBezPdv = stavke.reduce((sum, s) => sum + (Number(s.iznos) || 0), 0);
  const pdvIznos = obracunajPdv ? Math.round(ukupnoBezPdv * 0.20) : 0;
  const ukupnoSaPdv = ukupnoBezPdv + pdvIznos;

  const izmeniStavku = (index: number, polje: keyof StavkaSpecifikacije, vrednost: any) => {
    const kopija = [...stavke];
    const trenutna = { ...kopija[index], [polje]: vrednost };

    if (polje === 'kolicina' || polje === 'jed_cena') {
      const k = parseFloat(String(trenutna.kolicina).replace(',', '.')) || 0;
      const c = parseFloat(String(trenutna.jed_cena).replace(',', '.')) || 0;
      trenutna.iznos = Math.round(k * c);
    }

    kopija[index] = trenutna;
    setStavke(kopija);
  };

  const obrisiStavku = (index: number) => {
    const novaLista = stavke.filter((_, i) => i !== index).map((s, idx) => ({ ...s, br: idx + 1 }));
    setStavke(novaLista);
  };

  const dodajNovuStavku = () => {
    const nova: StavkaSpecifikacije = {
      br: stavke.length + 1,
      opis: '',
      jed_mere: 'kom',
      kolicina: 1,
      jed_cena: 0,
      iznos: 0,
      valuta
    };
    setStavke([...stavke, nova]);
  };

  const potvrdiISacuvaj = async () => {
    setCuva(true);
    try {
      const azuriran: LokalniPodsetnik = {
        ...posao,
        naslov: naslov.trim(),
        stavke,
        iznos: ukupnoBezPdv,
        obracunaj_pdv: obracunajPdv,
        pdv_procenat: 20,
        pdv_iznos: pdvIznos,
        ukupno_sa_pdv: ukupnoSaPdv,
        valuta,
        napomene: napomene.trim(),
        tip_zabelezke: 'posao'
      };

      await onSacuvaj(azuriran);
      onZatvori();
    } catch (e: any) {
      Alert.alert('Greška', e.message || 'Nije uspelo čuvanje.');
    } finally {
      setCuva(false);
    }
  };

  const podeliIliStampajPdf = async () => {
    setDeliPdf(true);
    try {
      const azuriran: LokalniPodsetnik = {
        ...posao,
        naslov: naslov.trim(),
        stavke,
        iznos: ukupnoBezPdv,
        obracunaj_pdv: obracunajPdv,
        pdv_iznos: pdvIznos,
        ukupno_sa_pdv: ukupnoSaPdv,
        valuta,
        napomene: napomene.trim()
      };
      await PdfService.generisiIDeliPdf(azuriran, korisnik);
    } catch (e: any) {
      Alert.alert('PDF Greška', e.message || 'Neuspešan izvoz u PDF.');
    } finally {
      setDeliPdf(false);
    }
  };

  const formatirajCifru = (br: number) => {
    return br.toLocaleString('sr-RS');
  };

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.listPapiraKontejner}>
        {/* Zaglavlje modala */}
        <View style={styles.modalHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.dokumentNadnaslov}>DOKUMENT: SPECIFIKACIJA POSLA</Text>
            <Text style={styles.dokumentDatum}>
              Kreirano: {new Date(posao.kreirano_na_uredjaju).toLocaleDateString('sr-RS')} u {new Date(posao.kreirano_na_uredjaju).toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          <TouchableOpacity style={styles.btnZatvori} onPress={onZatvori}>
            <Text style={styles.btnZatvoriTekst}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.papirScroll}>
          {/* List papira - Identican kao na Slici 1 */}
          <View style={styles.beliListPapira}>
            {/* Naslov dokumenta */}
            <Text style={styles.glavniNaslovSpecifikacije}>SPECIFIKACIJA GRAĐEVINSKOG MATERIJALA</Text>

            {/* Podnaslov / Naziv projekta */}
            <TextInput
              style={styles.podnaslovProjektaInput}
              value={naslov}
              onChangeText={setNaslov}
              placeholder="Unesite naziv projekta / radova (npr. Keramičke pločice – podne i zidne)..."
              placeholderTextColor="#94A3B8"
            />

            {/* TABELA STAVKI */}
            <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.horizontalScrollTable}>
              <View style={styles.tabelaWrapper}>
                {/* Zaglavlje tabele */}
                <View style={styles.tabelaHeaderRed}>
                  <Text style={[styles.tabelaHeaderCell, { width: 35 }]}>Br.</Text>
                  <Text style={[styles.tabelaHeaderCell, { width: 200 }]}>Opis</Text>
                  <Text style={[styles.tabelaHeaderCell, { width: 75 }]}>Jed. mere</Text>
                  <Text style={[styles.tabelaHeaderCell, { width: 75 }]}>Količina</Text>
                  <Text style={[styles.tabelaHeaderCell, { width: 105 }]}>Jed. cena ({valuta})</Text>
                  <Text style={[styles.tabelaHeaderCell, { width: 110 }]}>Ukupno ({valuta})</Text>
                  <Text style={[styles.tabelaHeaderCell, { width: 45, textAlign: 'center' }]}>Briši</Text>
                </View>

                {/* Redovi tabele */}
                {stavke.map((s, idx) => (
                  <View key={s.id || idx} style={[styles.tabelaRed, idx % 2 === 1 && styles.tabelaRedParan]}>
                    <Text style={[styles.cellTekst, { width: 35, textAlign: 'center', fontWeight: 'bold' }]}>
                      {idx + 1}
                    </Text>

                    <TextInput
                      style={[styles.cellInput, { width: 200 }]}
                      value={s.opis}
                      onChangeText={(val) => izmeniStavku(idx, 'opis', val)}
                      placeholder="Naziv materijala/usluge..."
                      placeholderTextColor="#94A3B8"
                    />

                    <TextInput
                      style={[styles.cellInput, { width: 75, textAlign: 'center' }]}
                      value={s.jed_mere || 'kom'}
                      onChangeText={(val) => izmeniStavku(idx, 'jed_mere', val)}
                      placeholder="m², kg..."
                      placeholderTextColor="#94A3B8"
                    />

                    <TextInput
                      style={[styles.cellInput, { width: 75, textAlign: 'center' }]}
                      value={String(s.kolicina ?? 1)}
                      keyboardType="numeric"
                      onChangeText={(val) => izmeniStavku(idx, 'kolicina', val)}
                    />

                    <TextInput
                      style={[styles.cellInput, { width: 105, textAlign: 'right' }]}
                      value={String(s.jed_cena ?? 0)}
                      keyboardType="numeric"
                      onChangeText={(val) => izmeniStavku(idx, 'jed_cena', val)}
                    />

                    <Text style={[styles.cellTekst, { width: 110, textAlign: 'right', fontWeight: 'bold', color: '#0F172A' }]}>
                      {formatirajCifru(Number(s.iznos) || 0)}
                    </Text>

                    <TouchableOpacity
                      style={[styles.btnBrisiStavku, { width: 45 }]}
                      onPress={() => obrisiStavku(idx)}
                    >
                      <Text style={styles.btnBrisiStavkuTekst}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </ScrollView>

            {/* Dugme za dodavanje novog reda */}
            <TouchableOpacity style={styles.btnDodajRed} onPress={dodajNovuStavku}>
              <Text style={styles.btnDodajRedTekst}>+ Dodaj novu stavku u tabelu</Text>
            </TouchableOpacity>

            {/* SEKCIJA REKAPITULACIJE I UKUPNIH SUMA (Tačno kao na slici 1) */}
            <View style={styles.rekapitulacijaSekcija}>
              <View style={styles.zbirRed}>
                <Text style={styles.zbirNaziv}>UKUPNO (bez PDV-a):</Text>
                <Text style={styles.zbirVrednost}>{formatirajCifru(ukupnoBezPdv)} {valuta}</Text>
              </View>

              <TouchableOpacity
                style={styles.zbirRedPdv}
                onPress={() => setObracunajPdv(!obracunajPdv)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.pdvCheckboxTekst}>{obracunajPdv ? '☑' : '☐'}</Text>
                  <Text style={styles.zbirNaziv}>PDV (20%):</Text>
                </View>
                <Text style={styles.zbirVrednost}>{formatirajCifru(pdvIznos)} {valuta}</Text>
              </TouchableOpacity>

              <View style={[styles.zbirRed, styles.zbirRedGlavni]}>
                <Text style={styles.zbirGlavniNaziv}>UKUPNO SA PDV-OM:</Text>
                <Text style={styles.zbirGlavnaVrednost}>{formatirajCifru(ukupnoSaPdv)} {valuta}</Text>
              </View>
            </View>

            {/* NAPOMENE (Kao na slici 1) */}
            <View style={styles.napomeneSekcija}>
              <Text style={styles.napomeneNaslov}>Napomene:</Text>
              <TextInput
                style={styles.napomeneInput}
                multiline
                numberOfLines={4}
                value={napomene}
                onChangeText={setNapomene}
                placeholder="Unesite napomene za klijenta/investitora..."
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>
        </ScrollView>

        {/* Dugmad na dnu ekrana */}
        <View style={styles.modalDugmadFooter}>
          <TouchableOpacity
            style={styles.btnPdfFooter}
            onPress={podeliIliStampajPdf}
            disabled={deliPdf}
          >
            {deliPdf ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.btnPdfFooterTekst}>📄 PDF / Štampa</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnSacuvajFooter}
            onPress={potvrdiISacuvaj}
            disabled={cuva}
          >
            {cuva ? (
              <ActivityIndicator color="#0F172A" size="small" />
            ) : (
              <Text style={styles.btnSacuvajFooterTekst}>💾 Sačuvaj izmene</Text>
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
  listPapiraKontejner: {
    width: '100%',
    maxWidth: 820,
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
    color: '#38BDF8',
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
  papirScroll: {
    padding: Platform.OS === 'web' ? 16 : 8
  },
  beliListPapira: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: Platform.OS === 'web' ? 28 : 16,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4
  },
  glavniNaslovSpecifikacije: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.5,
    marginBottom: 8
  },
  podnaslovProjektaInput: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    borderBottomWidth: 2,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 6,
    marginBottom: 20
  },
  horizontalScrollTable: {
    marginBottom: 12
  },
  tabelaWrapper: {
    minWidth: 640
  },
  tabelaHeaderRed: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#CBD5E1',
    paddingBottom: 8,
    marginBottom: 4
  },
  tabelaHeaderCell: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569'
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
  cellTekst: {
    fontSize: 13,
    color: '#1E293B'
  },
  cellInput: {
    fontSize: 13,
    color: '#0F172A',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    marginRight: 4
  },
  btnBrisiStavku: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4
  },
  btnBrisiStavkuTekst: {
    fontSize: 16
  },
  btnDodajRed: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#CBD5E1'
  },
  btnDodajRedTekst: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB'
  },
  rekapitulacijaSekcija: {
    borderTopWidth: 2,
    borderTopColor: '#0F172A',
    paddingTop: 14,
    marginBottom: 24,
    alignSelf: 'flex-start',
    minWidth: 320
  },
  zbirRed: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4
  },
  zbirRedPdv: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4
  },
  pdvCheckboxTekst: {
    fontSize: 16,
    color: '#2563EB',
    marginRight: 6,
    fontWeight: 'bold'
  },
  zbirNaziv: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155'
  },
  zbirVrednost: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A'
  },
  zbirRedGlavni: {
    borderTopWidth: 1,
    borderTopColor: '#CBD5E1',
    marginTop: 4,
    paddingTop: 6
  },
  zbirGlavniNaziv: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A'
  },
  zbirGlavnaVrednost: {
    fontSize: 16,
    fontWeight: '900',
    color: '#059669'
  },
  napomeneSekcija: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 16
  },
  napomeneNaslov: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8
  },
  napomeneInput: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    padding: 10,
    backgroundColor: '#F8FAFC'
  },
  modalDugmadFooter: {
    flexDirection: 'row',
    padding: 14,
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    gap: 12
  },
  btnPdfFooter: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#334155',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnPdfFooterTekst: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14
  },
  btnSacuvajFooter: {
    flex: 2,
    paddingVertical: 12,
    backgroundColor: '#F59E0B',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnSacuvajFooterTekst: {
    color: '#0F172A',
    fontWeight: '900',
    fontSize: 14
  }
});
