import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { StorageService, KorisnikCache, LicencaCache } from '../services/storage';
import { DEFAULT_API_URL } from '../services/sync';

interface AuthScreenProps {
  onUspesanLogin: (korisnik: KorisnikCache) => void;
}

export default function AuthScreen({ onUspesanLogin }: AuthScreenProps) {
  const [jeRegistracija, setJeRegistracija] = useState(false);
  const [korisnickoIme, setKorisnickoIme] = useState('');
  const [lozinka, setLozinka] = useState('');
  const [prikaziLozinku, setPrikaziLozinku] = useState(false);
  const [ime, setIme] = useState('');
  const [email, setEmail] = useState('');
  const [brojTelefona, setBrojTelefona] = useState('');
  const [ucitava, setUcitava] = useState(false);
  const [serverUrl, setServerUrl] = useState(DEFAULT_API_URL);
  const [statusPoruka, setStatusPoruka] = useState<{ tip: 'uspeh' | 'greska'; tekst: string } | null>(null);

  const izvrsiAkciju = async () => {
    if (!korisnickoIme.trim() || !lozinka.trim()) {
      Alert.alert('Greška', 'Korisničko ime i lozinka su obavezni.');
      return;
    }

    if (jeRegistracija) {
      if (lozinka.trim().length < 6) {
        Alert.alert('Greška', 'Lozinka mora imati najmanje 6 karaktera.');
        return;
      }

      // Provera formata Emaila (ako je unet)
      if (email.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
          Alert.alert('Neispravan Email', 'Unesite ispravnu email adresu (npr. petar@gmail.com).');
          return;
        }
      }

      // Provera formata Broja telefona: mora počinjati sa 06 ili +38106
      if (brojTelefona.trim()) {
        const ciscen = brojTelefona.trim().replace(/[\s\-\/]/g, '');
        const telRegex = /^(\+3810?6|06)\d{6,8}$/;
        if (!telRegex.test(ciscen)) {
          Alert.alert(
            'Neispravan broj telefona',
            'Broj telefona mora počinjati sa 06 ili +38106 i sadržati 9 do 13 cifara (npr. 0641234567 ili +3810641234567).'
          );
          return;
        }
      }
    }

    setUcitava(true);
    setStatusPoruka(null);
    try {
      const isPhp = serverUrl.includes('.php');
      const endpoint = isPhp
        ? `${serverUrl}?action=${jeRegistracija ? 'register' : 'login'}`
        : `${serverUrl}/auth/${jeRegistracija ? 'register' : 'login'}`;
      const body = jeRegistracija
        ? {
            korisnicko_ime: korisnickoIme.trim(),
            lozinka: lozinka.trim(),
            ime: ime.trim() || null,
            email: email.trim() || null,
            broj_telefona: brojTelefona.trim() || null
          }
        : {
            korisnicko_ime: korisnickoIme.trim(),
            lozinka: lozinka.trim()
          };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (!res.ok) {
        const poruka = data.message || data.poruka || 'Došlo je do greške.';
        setStatusPoruka({ tip: 'greska', tekst: poruka });
        if (Platform.OS !== 'web') Alert.alert('Greška', poruka);
        setUcitava(false);
        return;
      }

      if (jeRegistracija) {
        const uspehTekst = 'Čestitamo! Registracija je uspešna. Sada se možete prijaviti.';
        setStatusPoruka({ tip: 'uspeh', tekst: uspehTekst });
        if (Platform.OS !== 'web') Alert.alert('Čestitamo!', uspehTekst);
        setJeRegistracija(false);
      } else {
        // Uspešan login
        const korisnikData: KorisnikCache = {
          id: data.korisnik.id,
          role_id: data.korisnik.role_id,
          role: data.korisnik.role,
          korisnicko_ime: data.korisnik.korisnicko_ime,
          ime: data.korisnik.ime,
          token: data.token
        };

        const licencaData: LicencaCache = {
          token_active: data.korisnik.token_active,
          token_expires_at: data.korisnik.token_expires_at,
          besplatni_unosi_iskorisceno: data.korisnik.besplatni_unosi_iskorisceno,
          poslednja_sinhronizacija: data.korisnik.server_vreme || new Date().toISOString()
        };

        // Provera da li je drugi nalog ulogovan
        const prethodniKorisnik = await StorageService.getKorisnik();
        if (prethodniKorisnik && prethodniKorisnik.id !== data.korisnik.id) {
          await StorageService.ocistiLokalnePodsetnike();
        }

        await StorageService.sacuvajKorisnika(korisnikData);
        await StorageService.sacuvajLicencu(licencaData);
        onUspesanLogin(korisnikData);
      }
    } catch (err: any) {
      const errTekst = 'Nije moguće kontaktirati server. Proverite vezu sa serverom.';
      setStatusPoruka({ tip: 'greska', tekst: errTekst });
      if (Platform.OS !== 'web') Alert.alert('Greška u povezivanju', errTekst);
    } finally {
      setUcitava(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerBox}>
          <Text style={styles.logo}>🎙️ ZapišiTo</Text>
          <Text style={styles.podnaslov}>
            Glasovni asistent za majstore i terence
          </Text>
          <Text style={styles.badgeOffline}>⚡ Radi i bez interneta do 72h</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {jeRegistracija ? 'Nova Registracija (10 besplatnih)' : 'Prijava na nalog'}
          </Text>

          {statusPoruka && (
            <View
              style={[
                styles.statusBanner,
                statusPoruka.tip === 'uspeh' ? styles.statusUspeh : styles.statusGreska
              ]}
            >
              <Text
                style={[
                  styles.statusTekst,
                  statusPoruka.tip === 'uspeh' ? styles.statusTekstUspeh : styles.statusTekstGreska
                ]}
              >
                {statusPoruka.tip === 'uspeh' ? '✅ ' : '⚠️ '}
                {statusPoruka.tekst}
              </Text>
            </View>
          )}

          <Text style={styles.label}>Korisničko ime *</Text>
          <TextInput
            style={styles.input}
            placeholder="npr. majstor_milan"
            placeholderTextColor="#888"
            autoCapitalize="none"
            value={korisnickoIme}
            onChangeText={setKorisnickoIme}
          />

          <Text style={styles.label}>Lozinka *</Text>
          <View style={styles.lozinkaKontejner}>
            <TextInput
              style={styles.lozinkaInput}
              placeholder="Vaša lozinka"
              placeholderTextColor="#888"
              secureTextEntry={!prikaziLozinku}
              value={lozinka}
              onChangeText={setLozinka}
            />
            <TouchableOpacity
              style={styles.btnOko}
              onPress={() => setPrikaziLozinku(!prikaziLozinku)}
            >
              <Text style={styles.btnOkoTekst}>{prikaziLozinku ? '👁️' : '🙈'}</Text>
            </TouchableOpacity>
          </View>

          {jeRegistracija && (
            <>
              <Text style={styles.label}>Ime i prezime (opciono)</Text>
              <TextInput
                style={styles.input}
                placeholder="Vaše ime"
                placeholderTextColor="#888"
                value={ime}
                onChangeText={setIme}
              />

              <Text style={styles.label}>Email adresa (opciono)</Text>
              <TextInput
                style={styles.input}
                placeholder="npr. petar@gmail.com"
                placeholderTextColor="#888"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />

              <Text style={styles.label}>Broj telefona (06... ili +38106...)</Text>
              <TextInput
                style={styles.input}
                placeholder="npr. 0641234567 ili +3810641234567"
                placeholderTextColor="#888"
                keyboardType="phone-pad"
                value={brojTelefona}
                onChangeText={setBrojTelefona}
              />
            </>
          )}

          <TouchableOpacity
            style={styles.btnPrimarno}
            onPress={izvrsiAkciju}
            disabled={ucitava}
          >
            {ucitava ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnPrimarnoTekst}>
                {jeRegistracija ? 'Registruj se' : 'Prijavi se'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnPrebaci}
            onPress={() => setJeRegistracija(!jeRegistracija)}
          >
            <Text style={styles.btnPrebaciTekst}>
              {jeRegistracija
                ? 'Već imate nalog? Prijavite se'
                : 'Nemate nalog? Registrujte se (10 besplatnih unosa)'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scroll: { padding: 24, justifyContent: 'center', minHeight: '100%' },
  headerBox: { alignItems: 'center', marginBottom: 24, maxWidth: 440, width: '100%', alignSelf: 'center' },
  logo: { fontSize: 36, fontWeight: '900', color: '#059669', letterSpacing: 1 },
  podnaslov: { fontSize: 15, color: '#475569', marginTop: 6, textAlign: 'center' },
  badgeOffline: {
    backgroundColor: '#ECFDF5',
    color: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 10
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center'
  },
  cardTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginBottom: 16 },
  statusBanner: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16
  },
  statusUspeh: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#10B981'
  },
  statusGreska: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#EF4444'
  },
  statusTekst: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center'
  },
  statusTekstUspeh: {
    color: '#065F46'
  },
  statusTekstGreska: {
    color: '#991B1B'
  },
  label: { fontSize: 13, color: '#334155', marginBottom: 6, fontWeight: '600' },
  input: {
    backgroundColor: '#F8FAFC',
    color: '#0F172A',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    fontSize: 15,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1'
  },
  lozinkaKontejner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginBottom: 14
  },
  lozinkaInput: {
    flex: 1,
    color: '#0F172A',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15
  },
  btnOko: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  btnOkoTekst: {
    fontSize: 18
  },
  btnPrimarno: {
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8
  },
  btnPrimarnoTekst: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  btnPrebaci: { marginTop: 16, alignItems: 'center' },
  btnPrebaciTekst: { color: '#2563EB', fontSize: 13, fontWeight: '600' }
});
