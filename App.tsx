import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StatusBar, StyleSheet } from 'react-native';
import { StorageService, KorisnikCache } from './src/services/storage';
import AuthScreen from './src/screens/AuthScreen';
import HomeScreen from './src/screens/HomeScreen';
import AdminScreen from './src/screens/AdminScreen';

export default function App() {
  const [korisnik, setKorisnik] = useState<KorisnikCache | null>(null);
  const [ucitava, setUcitava] = useState(true);
  const [prikaziAdmin, setPrikaziAdmin] = useState(false);

  useEffect(() => {
    // Provera da li već imamo ulogovanog korisnika u kešu telefona (radi offline)
    StorageService.getKorisnik().then(sacuvan => {
      if (sacuvan) {
        setKorisnik(sacuvan);
      }
      setUcitava(false);
    });
  }, []);

  const rukujOdjavom = async () => {
    await StorageService.obrisiKorisnika();
    await StorageService.ocistiLokalnePodsetnike();
    setKorisnik(null);
    setPrikaziAdmin(false);
  };

  if (ucitava) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#101014" />
      {!korisnik ? (
        <AuthScreen onUspesanLogin={setKorisnik} />
      ) : prikaziAdmin ? (
        <AdminScreen onNazad={() => setPrikaziAdmin(false)} />
      ) : (
        <HomeScreen
          korisnik={korisnik}
          onOdjava={rukujOdjavom}
          onOtvoriAdmin={() => setPrikaziAdmin(true)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#101014' },
  loadingContainer: { flex: 1, backgroundColor: '#101014', justifyContent: 'center', alignItems: 'center' }
});
