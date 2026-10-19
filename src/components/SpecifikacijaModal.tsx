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
  Alert
} from 'react-native';
import { LokalniPodsetnik, StavkaSpecifikacije, KorisnikCache } from '../services/storage';
import { PdfService } from '../services/pdfService';
import { parsirajTekst } from '../services/parser';

interface SpecifikacijaModalProps {
  vidljiv: boolean;
  posao: LokalniPodsetnik | null;
  korisnik: KorisnikCache;
  onZatvori: () => void;
  onSacuvaj: (azuriran: LokalniPodsetnik) => Promise<void>;
}

const KATALOG_PREPORUKA = [
  { opis: 'Keramičke pločice', jed_mere: 'm²', jed_cena: 2500 },
  { opis: 'Lepak za keramiku', jed_mere: 'kg', jed_cena: 95 },
  { opis: 'Fug masa', jed_mere: 'kg', jed_cena: 350 },
  { opis: 'Glet masa', jed_mere: 'kg', jed_cena: 65 },
  { opis: 'Poludisperzija bela', jed_mere: 'kg', jed_cena: 180 },
  { opis: 'Podloga / prajmer', jed_mere: 'lit', jed_cena: 450 },
  { opis: 'Gips karton ploča', jed_mere: 'm²', jed_cena: 420 },
  { opis: 'Lepljenje keramike (rad)', jed_mere: 'm²', jed_cena: 1800 },
  { opis: 'Krečenje zidova (rad)', jed_mere: 'm²', jed_cena: 250 },
  { opis: 'Gletovanje zidova (rad)', jed_mere: 'm²', jed_cena: 350 },
  { opis: 'Rušenje i odvoz šuta (rad)', jed_mere: 'paušal', jed_cena: 12000 }
];

export default function SpecifikacijaModal({
  vidljiv,
  posao,
  korisnik,
  onZatvori,
  onSacuvaj
}: SpecifikacijaModalProps) {
  if (!vidljiv || !posao) return null;

  const [naslov, setNaslov] = useState(
    posao.naslov || posao.opis_zadatka || 'Specifikacija građevinskog materijala'
  );
  const [valuta, setValuta] = useState<'RSD' | 'EUR'>(posao.valuta || 'RSD');
  const [obracunajPdv, setObracunajPdv] = useState<boolean>(posao.obracunaj_pdv !== false);
  const [napomene, setNapomene] = useState(
    posao.napomene ||
      '• Cene su informativne i zavise od proizvođača, regiona i trenutka nabavke.\n• Količine uključuju rezervu od 5-10% za sečenje i lom.\n• Materijal mora imati atest i deklaraciju u skladu sa standardima.'
  );

  const dobaviInicijalneStavke = (p: LokalniPodsetnik): StavkaSpecifikacije[] => {
    if (p.stavke && Array.isArray(p.stavke) && p.stavke.length > 0) {
      return p.stavke.map((st, i) => ({
        ...st,
        id: st.id || `posao_${Date.now()}_${i}`,
        br: i + 1,
        jed_mere: st.jed_mere || 'kom',
        kolicina: st.kolicina || 1,
        jed_cena: st.jed_cena || (st.iznos || 0),
        iznos: st.iznos || (Number(st.kolicina) || 1) * (Number(st.jed_cena) || 0)
      }));
    }
    const tekst = p.sirovi_tekst || p.opis_zadatka || '';
    if (tekst.trim()) {
      const parsed = parsirajTekst(tekst, 'posao');
      if (parsed.stavke && parsed.stavke.length > 0) {
        return parsed.stavke;
      }
    }
    return [];
  };

  // Stavke tabele
  const [stavke, setStavke] = useState<StavkaSpecifikacije[]>(() => dobaviInicijalneStavke(posao));

  // Sinhronizuj stanje kada se klikne na drugi posao
  useEffect(() => {
    if (posao) {
      setNaslov(posao.naslov || posao.opis_zadatka || 'Građevinska specifikacija');
      setKlijentIme(posao.klijent_ime || '');
      setKlijentTelefon(posao.klijent_telefon || '');
      setLokacija(posao.lokacija || '');
      setValuta(posao.valuta || 'RSD');
      setObracunajPdv(posao.obracunaj_pdv !== false);
      setNapomene(posao.napomene || '• Cene su informativne i zavise od proizvođača, regiona i trenutka nabavke.\n• Količine uključuju rezervu od 5-10% za sečenje i lom.\n• Materijal mora imati atest i deklaraciju u skladu sa standardima.');
      setStavke(dobaviInicijalneStavke(posao));
    }
  }, [posao?.uuid_lokalni]);

  const [cuva, setCuva] = useState(false);
  const [deliPdf, setDeliPdf] = useState(false);

  // Proračuni
  const ukupnoBezPdv = stavke.reduce((sum, s) => sum + (Number(s.iznos) || 0), 0);
  const pdvIznos = obracunajPdv ? Math.round(ukupnoBezPdv * 0.2) : 0;
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

  const dodajIzKataloga = (artikal: { opis: string; jed_mere: string; jed_cena: number }) => {
    const nova: StavkaSpecifikacije = {
      br: stavke.length + 1,
      opis: artikal.opis,
      jed_mere: artikal.jed_mere,
      kolicina: 1,
      jed_cena: artikal.jed_cena,
      iznos: artikal.jed_cena,
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
            <Text style={styles.dokumentNadnaslov}>🔨 DOKUMENT: SPECIFIKACIJA POSLA</Text>
            <Text style={styles.dokumentDatum}>
              Kreirano: {new Date(posao.kreirano_na_uredjaju).toLocaleDateString('sr-RS')} u{' '}
              {new Date(posao.kreirano_na_uredjaju).toLocaleTimeString('sr-RS', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </Text>
          </View>
          <TouchableOpacity style={styles.btnZatvori} onPress={onZatvori}>
            <Text style={styles.btnZatvoriTekst}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.papirScroll}>
          {/* List papira */}
          <View style={styles.beliListPapira}>
            {/* Naslov dokumenta */}
            <Text style={styles.glavniNaslovSpecifikacije}>
              SPECIFIKACIJA GRAĐEVINSKOG MATERIJALA
            </Text>

            {/* Podnaslov / Naziv projekta */}
            <TextInput
              style={styles.podnaslovProjektaInput}
              value={naslov}
              onChangeText={setNaslov}
              placeholder="Unesite naziv projekta / radova (npr. Keramičke pločice – podne i zidne)..."
              placeholderTextColor="#94A3B8"
            />

            {/* Brzi katalog čestih materijala i radova (Joist stil) */}
            <Text style={styles.katalogLabel}>⚡ Brzi unos iz kataloga materijala i radova:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.katalogScroll}>
              {KATALOG_PREPORUKA.map((art, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.cipKatalog}
                  onPress={() => dodajIzKataloga(art)}
                >
                  <Text style={styles.cipKatalogTekst}>
                    + {art.opis} ({art.jed_cena} {valuta})
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* TABELA STAVKI */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={true}
              style={styles.horizontalScrollTable}
            >
              <View style={styles.tabelaWrapper}>
                {/* Zaglavlje tabele */}
                <View style={styles.tabelaHeaderRed}>
                  <Text style={[styles.tabelaHeaderCell, { width: 35 }]}>Br.</Text>
                  <Text style={[styles.tabelaHeaderCell, { width: 220 }]}>Opis materijala / radova</Text>
                  <Text style={[styles.tabelaHeaderCell, { width: 75, textAlign: 'center' }]}>Jed. mere</Text>
                  <Text style={[styles.tabelaHeaderCell, { width: 75, textAlign: 'center' }]}>Količina</Text>
                  <Text style={[styles.tabelaHeaderCell, { width: 110, textAlign: 'right' }]}>
                    Jed. cena ({valuta})
                  </Text>
                  <Text style={[styles.tabelaHeaderCell, { width: 115, textAlign: 'right' }]}>
                    Ukupno ({valuta})
                  </Text>
                  <Text style={[styles.tabelaHeaderCell, { width: 45, textAlign: 'center' }]}>Briši</Text>
                </View>

                {/* Redovi tabele */}
                {stavke.map((s, idx) => (
                  <View
                    key={s.id || idx}
                    style={[styles.tabelaRed, idx % 2 === 1 && styles.tabelaRedParan]}
                  >
                    <Text style={[styles.cellTekst, { width: 35, textAlign: 'center', fontWeight: 'bold' }]}>
                      {idx + 1}
                    </Text>

                    <TextInput
                      style={[styles.cellInput, { width: 220 }]}
                      value={s.opis}
                      onChangeText={val => izmeniStavku(idx, 'opis', val)}
                      placeholder="Naziv materijala/usluge..."
                      placeholderTextColor="#94A3B8"
                    />

                    <TextInput
                      style={[styles.cellInput, { width: 75, textAlign: 'center' }]}
                      value={s.jed_mere || 'kom'}
                      onChangeText={val => izmeniStavku(idx, 'jed_mere', val)}
                      placeholder="m², kg..."
                      placeholderTextColor="#94A3B8"
                    />

                    <TextInput
                      style={[styles.cellInput, { width: 75, textAlign: 'center' }]}
                      value={String(s.kolicina ?? 1)}
                      keyboardType="numeric"
                      onChangeText={val => izmeniStavku(idx, 'kolicina', val)}
                    />

                    <TextInput
                      style={[styles.cellInput, { width: 110, textAlign: 'right' }]}
                      value={String(s.jed_cena ?? 0)}
                      keyboardType="numeric"
                      onChangeText={val => izmeniStavku(idx, 'jed_cena', val)}
                    />

                    <Text
                      style={[
                        styles.cellTekst,
                        { width: 115, textAlign: 'right', fontWeight: 'bold', color: '#0F172A' }
                      ]}
                    >
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
            <TouchableOpacity style={styles.btnDodajStavku} onPress={dodajNovuStavku}>
              <Text style={styles.btnDodajStavkuTekst}>+ Dodaj novu stavku u tabelu</Text>
            </TouchableOpacity>

            {/* UKUPNE SUME I PDV */}
            <View style={styles.sumeKontejner}>
              <View style={styles.sumaRed}>
                <Text style={styles.sumaLabel}>Ukupno bez PDV-a:</Text>
                <Text style={styles.sumaVrednost}>
                  {formatirajCifru(ukupnoBezPdv)} {valuta}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.pdvCheckboxRed}
                onPress={() => setObracunajPdv(!obracunajPdv)}
              >
                <View style={[styles.pdvKocka, obracunajPdv && styles.pdvKockaAktivna]}>
                  {obracunajPdv && <Text style={styles.pdvKvacica}>✓</Text>}
                </View>
                <Text style={styles.pdvCheckboxTekst}>Obračunaj PDV (20%):</Text>
                <Text style={styles.pdvIznosTekst}>
                  {formatirajCifru(pdvIznos)} {valuta}
                </Text>
              </TouchableOpacity>

              <View style={styles.ukupnoZaUplatuRed}>
                <Text style={styles.ukupnoZaUplatuLabel}>SVEUKUPNO ZA UPLATU:</Text>
                <Text style={styles.ukupnoZaUplatuVrednost}>
                  {formatirajCifru(ukupnoSaPdv)} {valuta}
                </Text>
              </View>
            </View>

            {/* NAPOMENE MAJSTORA */}
            <View style={styles.napomeneKontejner}>
              <Text style={styles.napomeneNaslov}>Napomene i uslovi:</Text>
              <TextInput
                style={styles.napomeneInput}
                multiline
                numberOfLines={3}
                value={napomene}
                onChangeText={setNapomene}
                placeholder="Unesite dodatne napomene za klijenta..."
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>
        </ScrollView>

        {/* FOOTER SA AKCIJAMA */}
        <View style={styles.modalFooter}>
          <TouchableOpacity
            style={styles.btnDeliPdf}
            onPress={podeliIliStampajPdf}
            disabled={deliPdf}
          >
            {deliPdf ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.btnDeliPdfTekst}>📄 Izvezi PDF</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnSacuvaj}
            onPress={potvrdiISacuvaj}
            disabled={cuva}
          >
            {cuva ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
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
    zIndex: 9999,
    elevation: 25,
    padding: Platform.OS === 'web' ? 20 : 8
  },
  listPapiraKontejner: {
    width: '100%',
    maxWidth: 820,
    maxHeight: '94%',
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
  papirScroll: {
    padding: Platform.OS === 'web' ? 16 : 8
  },
  beliListPapira: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: Platform.OS === 'web' ? 26 : 14,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  glavniNaslovSpecifikacije: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.5,
    marginBottom: 8
  },
  podnaslovProjektaInput: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    borderBottomWidth: 2,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 6,
    marginBottom: 14
  },
  katalogLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 6
  },
  katalogScroll: {
    marginBottom: 14
  },
  cipKatalog: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    marginRight: 6
  },
  cipKatalogTekst: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600'
  },
  horizontalScrollTable: {
    marginBottom: 12
  },
  tabelaWrapper: {
    minWidth: 680
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
    paddingVertical: 5
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
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    marginHorizontal: 3,
    backgroundColor: '#FFFFFF'
  },
  btnBrisiStavku: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnBrisiStavkuTekst: {
    fontSize: 16
  },
  btnDodajStavku: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1'
  },
  btnDodajStavkuTekst: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7'
  },
  sumeKontejner: {
    marginTop: 20,
    borderTopWidth: 2,
    borderTopColor: '#E2E8F0',
    paddingTop: 12,
    alignSelf: 'flex-end',
    width: Platform.OS === 'web' ? 340 : '100%'
  },
  sumaRed: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  sumaLabel: {
    fontSize: 13,
    color: '#475569'
  },
  sumaVrednost: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A'
  },
  pdvCheckboxRed: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 4
  },
  pdvKocka: {
    width: 18,
    height: 18,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    borderRadius: 4,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF'
  },
  pdvKockaAktivna: {
    backgroundColor: '#10B981',
    borderColor: '#10B981'
  },
  pdvKvacica: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900'
  },
  pdvCheckboxTekst: {
    fontSize: 13,
    color: '#475569',
    flex: 1
  },
  pdvIznosTekst: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A'
  },
  ukupnoZaUplatuRed: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 2,
    borderTopColor: '#0F172A'
  },
  ukupnoZaUplatuLabel: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A'
  },
  ukupnoZaUplatuVrednost: {
    fontSize: 18,
    fontWeight: '900',
    color: '#059669'
  },
  napomeneKontejner: {
    marginTop: 20
  },
  napomeneNaslov: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 6
  },
  napomeneInput: {
    fontSize: 12,
    color: '#475569',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#F8FAFC',
    lineHeight: 18
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 12
  },
  btnDeliPdf: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#0284C7',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnDeliPdfTekst: {
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
