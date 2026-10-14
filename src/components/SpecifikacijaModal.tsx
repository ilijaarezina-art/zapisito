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
import { LokalniPodsetnik, StavkaSpecifikacije } from '../services/storage';
import { PdfService } from '../services/pdfService';
import { KorisnikCache } from '../services/storage';
import VoiceWaveform from './VoiceWaveform';

interface SpecifikacijaModalProps {
  vidljiv: boolean;
  posao: LokalniPodsetnik | null;
  korisnik: KorisnikCache;
  onZatvori: () => void;
  onSacuvaj: (azuriran: LokalniPodsetnik) => Promise<void>;
  onSnimajGlasom?: (polje: 'naziv' | 'klijent' | 'telefon' | 'adresa' | 'novaStavka') => void;
  aktivnoSnimaPolje?: string | null;
}

export default function SpecifikacijaModal({
  vidljiv,
  posao,
  korisnik,
  onZatvori,
  onSacuvaj,
  onSnimajGlasom,
  aktivnoSnimaPolje
}: SpecifikacijaModalProps) {
  if (!vidljiv || !posao) return null;

  const [klijentIme, setKlijentIme] = useState(posao.klijent_ime || '');
  const [klijentTelefon, setKlijentTelefon] = useState(posao.klijent_telefon || '');
  const [lokacija, setLokacija] = useState(posao.lokacija || '');
  const [opisZadatka, setOpisZadatka] = useState(posao.opis_zadatka || '');
  const [valuta, setValuta] = useState<'RSD' | 'EUR'>(posao.valuta || 'RSD');
  const [jeKapara, setJeKapara] = useState(posao.je_kapara || false);
  const [kaparaIznos, setKaparaIznos] = useState(posao.je_kapara ? String(posao.iznos || 0) : '0');

  // Stavke specifikacije materijala i usluga
  const [stavke, setStavke] = useState<StavkaSpecifikacije[]>(
    posao.stavke && posao.stavke.length > 0
      ? [...posao.stavke]
      : posao.iznos > 0
      ? [{ opis: posao.opis_zadatka || 'Glavni radovi', iznos: posao.iznos, valuta: posao.valuta }]
      : []
  );

  const [noviOpisStavke, setNoviOpisStavke] = useState('');
  const [novaKolicinaStavke, setNovaKolicinaStavke] = useState('');
  const [noviIznosStavke, setNoviIznosStavke] = useState('');
  const [cuva, setCuva] = useState(false);

  // Proračun sume
  const ukupnaSuma = stavke.reduce((sum, s) => sum + (Number(s.iznos) || 0), 0);
  const avansBroj = parseFloat(kaparaIznos.replace(',', '.')) || 0;
  const preostaloZaNaplatu = Math.max(0, ukupnaSuma - (jeKapara ? avansBroj : 0));

  const dodajStavku = () => {
    if (!noviOpisStavke.trim()) {
      Alert.alert('Unos stavke', 'Unesite opis stavke ili materijala.');
      return;
    }
    const iznosBroj = parseFloat(noviIznosStavke.replace(',', '.')) || 0;
    const nova: StavkaSpecifikacije = {
      opis: noviOpisStavke.trim(),
      kolicina: novaKolicinaStavke.trim() || undefined,
      iznos: iznosBroj,
      valuta
    };

    setStavke([...stavke, nova]);
    setNoviOpisStavke('');
    setNovaKolicinaStavke('');
    setNoviIznosStavke('');
  };

  const obrisiStavku = (index: number) => {
    const kopija = [...stavke];
    kopija.splice(index, 1);
    setStavke(kopija);
  };

  const potvrdiISacuvaj = async () => {
    setCuva(true);
    try {
      const azuriran: LokalniPodsetnik = {
        ...posao,
        klijent_ime: klijentIme.trim(),
        klijent_telefon: klijentTelefon.trim() || null,
        lokacija: lokacija.trim(),
        opis_zadatka: opisZadatka.trim(),
        valuta,
        stavke: stavke.map(s => ({ ...s, valuta })),
        iznos: ukupnaSuma > 0 ? ukupnaSuma : avansBroj,
        je_kapara: jeKapara
      };

      await onSacuvaj(azuriran);
      onZatvori();
    } catch (e: any) {
      Alert.alert('Greška', e.message || 'Nije uspelo čuvanje.');
    } finally {
      setCuva(false);
    }
  };

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.listPapiraKontejner}>
        {/* Zaglavlje lista papira */}
        <View style={styles.papirHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.papirNaslov}>📋 SPECIFIKACIJA RADOVA I MATERIJALA</Text>
            <Text style={styles.papirPodnaslov}>
              Predračun / Nalog #{posao.uuid_lokalni.slice(-6).toUpperCase()}
            </Text>
          </View>
          <TouchableOpacity style={styles.btnZatvori} onPress={onZatvori}>
            <Text style={styles.btnZatvoriTekst}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.papirScroll}>
          {/* Zaglavlje sa podacima klijenta i lokacije */}
          <View style={styles.sekcijaKlijent}>
            <View style={styles.redPolje}>
              <Text style={styles.labelPapir}>Klijent:</Text>
              <TextInput
                style={styles.inputPapir}
                placeholder="Ime i prezime..."
                placeholderTextColor="#94A3B8"
                value={klijentIme}
                onChangeText={setKlijentIme}
              />
              {onSnimajGlasom && (
                <TouchableOpacity
                  style={[styles.btnMikrofonMalo, aktivnoSnimaPolje === 'klijent' && styles.btnMikrofonMaloAktivno]}
                  onPress={() => onSnimajGlasom('klijent')}
                >
                  <Text style={styles.btnMikrofonMaloTekst}>🎙️</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.redPolje}>
              <Text style={styles.labelPapir}>Telefon:</Text>
              <TextInput
                style={styles.inputPapir}
                placeholder="06... ili +381..."
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                value={klijentTelefon}
                onChangeText={setKlijentTelefon}
              />
              {onSnimajGlasom && (
                <TouchableOpacity
                  style={[styles.btnMikrofonMalo, aktivnoSnimaPolje === 'telefon' && styles.btnMikrofonMaloAktivno]}
                  onPress={() => onSnimajGlasom('telefon')}
                >
                  <Text style={styles.btnMikrofonMaloTekst}>🎙️</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.redPolje}>
              <Text style={styles.labelPapir}>Adresa / Radilište:</Text>
              <TextInput
                style={styles.inputPapir}
                placeholder="Ulica i broj, mesto..."
                placeholderTextColor="#94A3B8"
                value={lokacija}
                onChangeText={setLokacija}
              />
              {onSnimajGlasom && (
                <TouchableOpacity
                  style={[styles.btnMikrofonMalo, aktivnoSnimaPolje === 'adresa' && styles.btnMikrofonMaloAktivno]}
                  onPress={() => onSnimajGlasom('adresa')}
                >
                  <Text style={styles.btnMikrofonMaloTekst}>🎙️</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.redPolje}>
              <Text style={styles.labelPapir}>Opis posla:</Text>
              <TextInput
                style={styles.inputPapir}
                placeholder="npr. Renoviranje kupatila, postavljanje keramike..."
                placeholderTextColor="#94A3B8"
                value={opisZadatka}
                onChangeText={setOpisZadatka}
              />
            </View>
          </View>

          {/* Izbor valute za specifikaciju */}
          <View style={styles.valutaIzborRed}>
            <Text style={styles.valutaOznaka}>Valuta obračuna:</Text>
            <TouchableOpacity
              style={[styles.valutaBtn, valuta === 'RSD' && styles.valutaBtnAktivno]}
              onPress={() => setValuta('RSD')}
            >
              <Text style={[styles.valutaBtnTekst, valuta === 'RSD' && styles.valutaBtnTekstAktivno]}>
                🇷🇸 RSD (Dinar)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.valutaBtn, valuta === 'EUR' && styles.valutaBtnAktivno]}
              onPress={() => setValuta('EUR')}
            >
              <Text style={[styles.valutaBtnTekst, valuta === 'EUR' && styles.valutaBtnTekstAktivno]}>
                🇪🇺 EUR (€ Evro)
              </Text>
            </TouchableOpacity>
          </View>

          {/* TABELA SPECIFIKACIJE (LIST PAPIRA) */}
          <View style={styles.tabelaKontejner}>
            <View style={styles.tabelaHeader}>
              <Text style={[styles.tabelaTh, { flex: 2 }]}>Artikal / Materijal / Rad</Text>
              <Text style={[styles.tabelaTh, { width: 80, textAlign: 'center' }]}>Količina</Text>
              <Text style={[styles.tabelaTh, { width: 90, textAlign: 'right' }]}>Cena ({valuta})</Text>
              <Text style={[styles.tabelaTh, { width: 34 }]}></Text>
            </View>

            {stavke.length === 0 ? (
              <View style={styles.tabelaPrazno}>
                <Text style={styles.tabelaPraznoTekst}>Nema unetih stavki. Dodajte prvu stavku ispod.</Text>
              </View>
            ) : (
              stavke.map((st, idx) => (
                <View key={idx} style={[styles.tabelaRed, idx % 2 === 1 && styles.tabelaRedParno]}>
                  <Text style={[styles.tabelaTd, { flex: 2, fontWeight: '600' }]}>{st.opis}</Text>
                  <Text style={[styles.tabelaTd, { width: 80, textAlign: 'center', color: '#64748B' }]}>
                    {st.kolicina || '-'}
                  </Text>
                  <Text style={[styles.tabelaTd, { width: 90, textAlign: 'right', fontWeight: '800', color: '#0F172A' }]}>
                    {Number(st.iznos).toLocaleString()}
                  </Text>
                  <TouchableOpacity style={styles.btnBrisiStavku} onPress={() => obrisiStavku(idx)}>
                    <Text style={styles.btnBrisiStavkuTekst}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}

            {/* FORMA ZA DODAVANJE NOVE STAVKE */}
            <View style={styles.novaStavkaForma}>
              <TextInput
                style={[styles.inputNovaStavka, { flex: 2 }]}
                placeholder="Naziv materijala/rada"
                placeholderTextColor="#94A3B8"
                value={noviOpisStavke}
                onChangeText={setNoviOpisStavke}
              />
              <TextInput
                style={[styles.inputNovaStavka, { width: 75 }]}
                placeholder="Kol (3 kom)"
                placeholderTextColor="#94A3B8"
                value={novaKolicinaStavke}
                onChangeText={setNovaKolicinaStavke}
              />
              <TextInput
                style={[styles.inputNovaStavka, { width: 85 }]}
                placeholder="Iznos"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                value={noviIznosStavke}
                onChangeText={setNoviIznosStavke}
              />
              <TouchableOpacity style={styles.btnDodajStavku} onPress={dodajStavku}>
                <Text style={styles.btnDodajStavkuTekst}>+ Dodaj</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* TOTAL / FINANSIJSKI ZBIR PAPIRA */}
          <View style={styles.zbirPapirKutija}>
            <View style={styles.zbirPapirRed}>
              <Text style={styles.zbirPapirLabel}>UKUPNA SPECIFIKACIJA:</Text>
              <Text style={styles.zbirPapirIznos}>
                {ukupnaSuma.toLocaleString()} {valuta}
              </Text>
            </View>

            <View style={styles.kaparaPapirRed}>
              <TouchableOpacity
                style={styles.kaparaCheckbox}
                onPress={() => setJeKapara(!jeKapara)}
              >
                <Text style={{ fontSize: 18 }}>{jeKapara ? '☑️' : '⬜'}</Text>
                <Text style={styles.kaparaTekst}>Uzeti avans / kapara:</Text>
              </TouchableOpacity>

              {jeKapara && (
                <TextInput
                  style={styles.kaparaInput}
                  keyboardType="numeric"
                  value={kaparaIznos}
                  onChangeText={setKaparaIznos}
                  placeholder="0"
                />
              )}
            </View>

            {jeKapara && avansBroj > 0 && (
              <View style={[styles.zbirPapirRed, { borderTopWidth: 1, borderTopColor: '#CBD5E1', paddingTop: 8 }]}>
                <Text style={[styles.zbirPapirLabel, { color: '#059669' }]}>PREOSTALO ZA NAPLATU:</Text>
                <Text style={[styles.zbirPapirIznos, { color: '#059669' }]}>
                  {preostaloZaNaplatu.toLocaleString()} {valuta}
                </Text>
              </View>
            )}
          </View>

          {/* DUGME ZA 1-KLIK PDF PREDRACUN */}
          <TouchableOpacity
            style={styles.btnPdfDirektno}
            onPress={() => {
              const azuriran: LokalniPodsetnik = {
                ...posao,
                klijent_ime: klijentIme,
                klijent_telefon: klijentTelefon,
                lokacija,
                opis_zadatka: opisZadatka,
                valuta,
                stavke,
                iznos: ukupnaSuma > 0 ? ukupnaSuma : avansBroj,
                je_kapara: jeKapara
              };
              PdfService.otvoriIliPodeliPdf(azuriran, korisnik);
            }}
          >
            <Text style={styles.btnPdfDirektnoTekst}>📄 Štampaj / Pošalji zvanični PDF predračun</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Dugmad na dnu modalnog papira */}
        <View style={styles.papirFooter}>
          <TouchableOpacity style={styles.btnOdustani} onPress={onZatvori}>
            <Text style={styles.btnOdustaniTekst}>Zatvori</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnSacuvajPapir} onPress={potvrdiISacuvaj} disabled={cuva}>
            {cuva ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnSacuvajPapirTekst}>💾 SAČUVAJ SPECIFIKACIJU</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
    padding: 12
  },
  listPapiraKontejner: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    width: '100%',
    maxWidth: 760,
    maxHeight: '92%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 25
  },
  papirHeader: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  papirNaslov: { color: '#38BDF8', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  papirPodnaslov: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
  btnZatvori: { padding: 8 },
  btnZatvoriTekst: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
  papirScroll: { padding: 18, gap: 14 },
  sekcijaKlijent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8
  },
  redPolje: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  labelPapir: { width: 110, fontSize: 13, fontWeight: '700', color: '#475569' },
  inputPapir: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#CBD5E1'
  },
  btnMikrofonMalo: {
    backgroundColor: '#E2E8F0',
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center'
  },
  btnMikrofonMaloAktivno: { backgroundColor: '#EF4444' },
  btnMikrofonMaloTekst: { fontSize: 16 },
  valutaIzborRed: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  valutaOznaka: { fontSize: 13, fontWeight: '700', color: '#334155' },
  valutaBtn: {
    backgroundColor: '#E2E8F0',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8
  },
  valutaBtnAktivno: { backgroundColor: '#0284C7' },
  valutaBtnTekst: { color: '#475569', fontSize: 13, fontWeight: '700' },
  valutaBtnTekstAktivno: { color: '#FFFFFF' },
  tabelaKontejner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden'
  },
  tabelaHeader: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    paddingVertical: 10,
    paddingHorizontal: 12
  },
  tabelaTh: { color: '#F8FAFC', fontSize: 12, fontWeight: '800' },
  tabelaPrazno: { padding: 20, alignItems: 'center' },
  tabelaPraznoTekst: { color: '#94A3B8', fontSize: 13, fontStyle: 'italic' },
  tabelaRed: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  tabelaRedParno: { backgroundColor: '#F8FAFC' },
  tabelaTd: { fontSize: 13, color: '#1E293B' },
  btnBrisiStavku: { width: 34, alignItems: 'center' },
  btnBrisiStavkuTekst: { color: '#EF4444', fontWeight: '800', fontSize: 14 },
  novaStavkaForma: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#F1F5F9',
    gap: 8,
    alignItems: 'center'
  },
  inputNovaStavka: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    color: '#0F172A'
  },
  btnDodajStavku: {
    backgroundColor: '#059669',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6
  },
  btnDodajStavkuTekst: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  zbirPapirKutija: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    gap: 10
  },
  zbirPapirRed: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  zbirPapirLabel: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  zbirPapirIznos: { fontSize: 20, fontWeight: '900', color: '#0284C7' },
  kaparaPapirRed: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kaparaCheckbox: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kaparaTekst: { fontSize: 14, fontWeight: '600', color: '#475569' },
  kaparaInput: {
    width: 120,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 15,
    fontWeight: '800',
    color: '#D97706',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    textAlign: 'right'
  },
  btnPdfDirektno: {
    backgroundColor: '#0284C7',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center'
  },
  btnPdfDirektnoTekst: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  papirFooter: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    flexDirection: 'row',
    gap: 12
  },
  btnOdustani: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#E2E8F0'
  },
  btnOdustaniTekst: { color: '#475569', fontWeight: '700', fontSize: 14 },
  btnSacuvajPapir: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center'
  },
  btnSacuvajPapirTekst: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 }
});
