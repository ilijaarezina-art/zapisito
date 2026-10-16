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
import { LokalniPodsetnik } from '../services/storage';

interface ZakazaniPosaoModalProps {
  vidljiv: boolean;
  posao: LokalniPodsetnik | null;
  onZatvori: () => void;
  onSacuvaj: (azuriran: LokalniPodsetnik) => Promise<void>;
}

export default function ZakazaniPosaoModal({
  vidljiv,
  posao,
  onZatvori,
  onSacuvaj
}: ZakazaniPosaoModalProps) {
  if (!vidljiv || !posao) return null;

  const [imePrezime, setImePrezime] = useState(posao.klijent_ime || '');
  const [telefon, setTelefon] = useState(posao.klijent_telefon || '');
  const [adresaGrad, setAdresaGrad] = useState(posao.lokacija || '');
  const [datumTermina, setDatumTermina] = useState(
    posao.rok_datum ? new Date(posao.rok_datum).toISOString().slice(0, 16).replace('T', ' ') : ''
  );
  const [napomena, setNapomena] = useState(posao.opis_zadatka || '');
  const [cuva, setCuva] = useState(false);

  const potvrdiISacuvaj = async () => {
    setCuva(true);
    try {
      let isoDatum: string | null = null;
      if (datumTermina.trim()) {
        const parsed = new Date(datumTermina.trim().replace(' ', 'T'));
        if (!isNaN(parsed.getTime())) {
          isoDatum = parsed.toISOString();
        } else {
          isoDatum = posao.rok_datum;
        }
      }

      const azuriran: LokalniPodsetnik = {
        ...posao,
        klijent_ime: imePrezime.trim(),
        klijent_telefon: telefon.trim() || null,
        lokacija: adresaGrad.trim(),
        rok_datum: isoDatum,
        opis_zadatka: napomena.trim(),
        naslov: imePrezime.trim() ? `Termin: ${imePrezime.trim()}` : 'Zakazan radni nalog',
        tip_zabelezke: 'zakazano'
      };

      await onSacuvaj(azuriran);
      onZatvori();
    } catch (e: any) {
      Alert.alert('Greška', e.message || 'Nije uspelo čuvanje.');
    } finally {
      setCuva(false);
    }
  };

  const pozoviKlijenta = () => {
    if (!telefon) {
      Alert.alert('Telefon', 'Broj telefona nije unet.');
      return;
    }
    Linking.openURL(`tel:${telefon}`);
  };

  const otvoriNavigaciju = () => {
    if (!adresaGrad) {
      Alert.alert('Adresa', 'Adresa ili grad nisu uneti.');
      return;
    }
    const url = Platform.select({
      ios: `maps:0,0?q=${encodeURIComponent(adresaGrad)}`,
      android: `geo:0,0?q=${encodeURIComponent(adresaGrad)}`,
      web: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresaGrad)}`
    });
    if (url) Linking.openURL(url);
  };

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.prozorKontejner}>
        {/* Zaglavlje */}
        <View style={styles.modalHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.dokumentNadnaslov}>DOKUMENT: ZAKAZANI POSAO / TERMIN</Text>
            <Text style={styles.dokumentDatum}>
              Radni nalog #{posao.uuid_lokalni.slice(-6).toUpperCase()}
            </Text>
          </View>
          <TouchableOpacity style={styles.btnZatvori} onPress={onZatvori}>
            <Text style={styles.btnZatvoriTekst}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollSadrzaj}>
          <View style={styles.beliList}>
            <Text style={styles.glavniNaslov}>RADNI NALOG / ZAKAZANI TERMIN</Text>

            {/* 1. IME I PREZIME */}
            <View style={styles.poljeGrupa}>
              <Text style={styles.poljeLabel}>Ime i prezime klijenta:</Text>
              <TextInput
                style={styles.inputTekst}
                value={imePrezime}
                onChangeText={setImePrezime}
                placeholder="Unesite ime i prezime (npr. Petar Petrović)..."
                placeholderTextColor="#94A3B8"
              />
            </View>

            {/* 2. BROJ TELEFONA */}
            <View style={styles.poljeGrupa}>
              <View style={styles.labelRed}>
                <Text style={styles.poljeLabel}>Broj telefona:</Text>
                {telefon ? (
                  <TouchableOpacity style={styles.btnBrzaAkcija} onPress={pozoviKlijenta}>
                    <Text style={styles.btnBrzaAkcijaTekst}>📞 Pozovi odmah</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <TextInput
                style={styles.inputTekst}
                value={telefon}
                onChangeText={setTelefon}
                keyboardType="phone-pad"
                placeholder="Unesite broj (npr. 064 123 4567)..."
                placeholderTextColor="#94A3B8"
              />
            </View>

            {/* 3. ADRESA I GRAD */}
            <View style={styles.poljeGrupa}>
              <View style={styles.labelRed}>
                <Text style={styles.poljeLabel}>Adresa i grad:</Text>
                {adresaGrad ? (
                  <TouchableOpacity style={styles.btnBrzaAkcija} onPress={otvoriNavigaciju}>
                    <Text style={styles.btnBrzaAkcijaTekst}>🗺️ Otvori na mapi</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <TextInput
                style={styles.inputTekst}
                value={adresaGrad}
                onChangeText={setAdresaGrad}
                placeholder="Unesite ulicu, broj i grad (npr. Knez Mihailova 12, Smederevo)..."
                placeholderTextColor="#94A3B8"
              />
            </View>

            {/* 4. DATUM ZAKAZANOG TERMINA */}
            <View style={styles.poljeGrupa}>
              <Text style={styles.poljeLabel}>Datum i vreme zakazanog termina (YYYY-MM-DD HH:MM):</Text>
              <TextInput
                style={styles.inputTekst}
                value={datumTermina}
                onChangeText={setDatumTermina}
                placeholder="npr. 2026-10-20 10:00"
                placeholderTextColor="#94A3B8"
              />
            </View>

            {/* 5. NAPOMENA / OPIS POSLA */}
            <View style={styles.poljeGrupa}>
              <Text style={styles.poljeLabel}>Napomena (vrsta posla, materijal, dogovor):</Text>
              <TextInput
                style={[styles.inputTekst, styles.inputMultiline]}
                value={napomena}
                onChangeText={setNapomena}
                multiline
                numberOfLines={4}
                placeholder="Unesite detalje dogovora, šta tačno treba uraditi..."
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.modalFooter}>
          {telefon ? (
            <TouchableOpacity style={styles.btnPoziv} onPress={pozoviKlijenta}>
              <Text style={styles.btnPozivTekst}>📞 Pozovi</Text>
            </TouchableOpacity>
          ) : null}

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
    maxWidth: 680,
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
  glavniNaslov: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.5,
    borderBottomWidth: 2,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 8,
    marginBottom: 16
  },
  poljeGrupa: {
    marginBottom: 16
  },
  labelRed: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  poljeLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 4
  },
  btnBrzaAkcija: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    backgroundColor: '#E0F2FE',
    borderRadius: 4
  },
  btnBrzaAkcijaTekst: {
    color: '#0284C7',
    fontSize: 11,
    fontWeight: 'bold'
  },
  inputTekst: {
    fontSize: 14,
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC'
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
    lineHeight: 20
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 14,
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    gap: 12
  },
  btnPoziv: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#0284C7',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnPozivTekst: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13
  },
  btnSacuvaj: {
    flex: 2,
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
