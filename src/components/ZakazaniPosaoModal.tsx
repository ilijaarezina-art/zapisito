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

  useEffect(() => {
    if (posao) {
      setImePrezime(posao.klijent_ime || '');
      setTelefon(posao.klijent_telefon || '');
      setAdresaGrad(posao.lokacija || '');
      setDatumTermina(posao.rok_datum ? new Date(posao.rok_datum).toISOString().slice(0, 16).replace('T', ' ') : '');
      setNapomena(posao.opis_zadatka || '');
    }
  }, [posao?.uuid_lokalni]);

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

  const posaljiPotvrduTermina = () => {
    const datum = datumTermina ? datumTermina : 'dogovorenom terminu';
    const ime = imePrezime ? ` ${imePrezime}` : '';
    const adresa = adresaGrad ? ` na adresi ${adresaGrad}` : '';
    const poruka = `Pozdrav${ime}, potvrđujem zakazani termin${adresa} (${datum}) za radove: "${napomena || 'dogovoreni posao'}". Vidimo se!`;

    if (telefon) {
      let tel = telefon.replace(/[\s\-\/]/g, '');
      if (tel.startsWith('06')) tel = '381' + tel.slice(1);
      if (tel.startsWith('+')) tel = tel.slice(1);
      Linking.openURL(`https://wa.me/${tel}?text=${encodeURIComponent(poruka)}`).catch(() => {
        Linking.openURL(`sms:${telefon}?body=${encodeURIComponent(poruka)}`);
      });
    } else {
      Linking.openURL(`https://wa.me/?text=${encodeURIComponent(poruka)}`).catch(() => {});
    }
  };

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.prozorKontejner}>
        {/* Zaglavlje - Moderni svetli stil */}
        <View style={styles.modalHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.dokumentNadnaslov}>📅 DOKUMENT: ZAKAZANI POSAO / TERMIN</Text>
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
                placeholder="npr. Jovan Petrović..."
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
                placeholder="npr. 064 123 4567..."
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
              />
            </View>

            {/* 3. ADRESA I GRAD */}
            <View style={styles.poljeGrupa}>
              <View style={styles.labelRed}>
                <Text style={styles.poljeLabel}>Adresa i grad:</Text>
                {adresaGrad ? (
                  <TouchableOpacity style={styles.btnBrzaAkcija} onPress={otvoriNavigaciju}>
                    <Text style={styles.btnBrzaAkcijaTekst}>🗺️ Otvori navigaciju</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <TextInput
                style={styles.inputTekst}
                value={adresaGrad}
                onChangeText={setAdresaGrad}
                placeholder="npr. Smederevo, Knez Mihailova 12..."
                placeholderTextColor="#94A3B8"
              />
            </View>

            {/* 4. DATUM I VREME TERMINA */}
            <View style={styles.poljeGrupa}>
              <Text style={styles.poljeLabel}>Datum i vreme termina:</Text>
              <TextInput
                style={styles.inputTekst}
                value={datumTermina}
                onChangeText={setDatumTermina}
                placeholder="GGGG-MM-DD SS:MM (npr. 2026-10-25 10:00)..."
                placeholderTextColor="#94A3B8"
              />
            </View>

            {/* 5. OPIS POSLA / NAPOMENA */}
            <View style={styles.poljeGrupa}>
              <Text style={styles.poljeLabel}>Vrsta posla i napomene majstora:</Text>
              <TextInput
                style={[styles.inputTekst, styles.inputMultiline]}
                value={napomena}
                onChangeText={setNapomena}
                placeholder="npr. Krečenje stana 60 kvadrata, popravka instalacije, priprema podloge..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
              />
            </View>
          </View>
        </ScrollView>

        {/* Footer sa akcijama */}
        <View style={styles.modalFooter}>
          <TouchableOpacity
            style={styles.btnPotvrdiPorukom}
            onPress={posaljiPotvrduTermina}
          >
            <Text style={styles.btnPotvrdiPorukomTekst}>💬 WhatsApp potvrda</Text>
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
    maxWidth: 720,
    maxHeight: '90%',
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
    color: '#4F46E5',
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
  glavniNaslov: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.5,
    borderBottomWidth: 2,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 8,
    marginBottom: 16
  },
  poljeGrupa: {
    marginBottom: 14
  },
  labelRed: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  poljeLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155'
  },
  btnBrzaAkcija: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    backgroundColor: '#EEF2FF',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#C7D2FE'
  },
  btnBrzaAkcijaTekst: {
    color: '#4F46E5',
    fontSize: 11,
    fontWeight: 'bold'
  },
  inputTekst: {
    fontSize: 14,
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF'
  },
  inputMultiline: {
    minHeight: 70,
    textAlignVertical: 'top',
    lineHeight: 20
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 12
  },
  btnPotvrdiPorukom: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#25D366',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnPotvrdiPorukomTekst: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13
  },
  btnSacuvaj: {
    flex: 1.5,
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
