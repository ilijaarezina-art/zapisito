import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  Platform,
  Alert
} from 'react-native';
import { LokalniPodsetnik } from '../services/storage';

interface ZakazaniPosloviViewProps {
  podsetnici: LokalniPodsetnik[];
  onIzaberiPosao: (item: LokalniPodsetnik) => void;
  onObrisi: (uuid: string) => void;
  onZavrsiPosao: (uuid: string, trenutno: boolean) => void;
}

export default function ZakazaniPosloviView({
  podsetnici,
  onIzaberiPosao,
  onObrisi,
  onZavrsiPosao
}: ZakazaniPosloviViewProps) {
  // Filtriramo poslove tipa 'zakazano' ili koji imaju termin, sortirani po kreiranju opadajuće (najnovije na vrhu)
  const zakazani = podsetnici
    .filter(p => p.tip_zabelezke === 'zakazano' || (!p.tip_zabelezke && p.rok_datum))
    .sort((a, b) => new Date(b.kreirano_na_uredjaju).getTime() - new Date(a.kreirano_na_uredjaju).getTime());

  const pozoviBroj = (broj?: string | null) => {
    if (!broj) {
      Alert.alert('Telefon', 'Klijent nema upisan broj telefona.');
      return;
    }
    Linking.openURL(`tel:${broj}`).catch(() => {});
  };

  const otvoriNavigaciju = (lokacija?: string) => {
    if (!lokacija) {
      Alert.alert('Lokacija', 'Adresa ili grad nisu upisani.');
      return;
    }
    const url = Platform.select({
      ios: `maps:0,0?q=${encodeURIComponent(lokacija)}`,
      android: `geo:0,0?q=${encodeURIComponent(lokacija)}`,
      web: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lokacija)}`
    });
    if (url) Linking.openURL(url).catch(() => {});
  };

  if (zakazani.length === 0) {
    return (
      <View style={styles.prazno}>
        <Text style={styles.praznoIkona}>📅</Text>
        <Text style={styles.praznoNaslov}>Nemate zakazanih poslova</Text>
        <Text style={styles.praznoTekst}>
          Pritisnite glavno dugme "Zapiši to" na dnu ekrana i izdiktirajte zakazivanje (npr. "Jovan Petrović, 064 123 4567, Smederevo Knez Mihailova 12, sutra u 10 sati, krečenje stana").
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.listaKontejner}>
      <View style={styles.zaglavljeTraka}>
        <Text style={styles.zaglavljeNaslov}>ZAKAZANI POSLOVI I TERMINI ({zakazani.length})</Text>
      </View>

      {zakazani.map((item, idx) => {
        const datumTerminaStr = item.rok_datum
          ? new Date(item.rok_datum).toLocaleDateString('sr-RS', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit'
            })
          : 'Termin nije definisan';

        const datumKreiranjaStr = new Date(item.kreirano_na_uredjaju).toLocaleDateString('sr-RS', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit'
        });

        return (
          <TouchableOpacity
            key={item.uuid_lokalni}
            style={[styles.karticaRed, item.je_zavrseno && styles.karticaRedZavrseno]}
            activeOpacity={0.8}
            onPress={() => onIzaberiPosao(item)}
          >
            {/* Leva strana: Ikona i Redni broj */}
            <View style={styles.ikonaOmotac}>
              <Text style={styles.ikonaTekst}>📅</Text>
              <Text style={styles.redniBrojTekst}>#{idx + 1}</Text>
            </View>

            {/* Sredina: Ime i prezime, telefon, adresa, termin, napomena */}
            <View style={styles.srednjiDeo}>
              <View style={styles.naslovRed}>
                <Text style={styles.klijentIme} numberOfLines={1}>
                  {item.klijent_ime || 'Klijent (nije navedeno ime)'}
                </Text>
                <Text style={styles.datumKreiranja}>{datumKreiranjaStr}</Text>
              </View>

              {/* Termin bedž */}
              <View style={styles.terminBedz}>
                <Text style={styles.terminBedzTekst}>⏰ Termin: {datumTerminaStr}</Text>
              </View>

              {/* Adresa i lokacija */}
              {item.lokacija ? (
                <Text style={styles.infoTekst} numberOfLines={1}>
                  📍 {item.lokacija}
                </Text>
              ) : null}

              {/* Telefon */}
              {item.klijent_telefon ? (
                <Text style={styles.infoTekst} numberOfLines={1}>
                  📞 {item.klijent_telefon}
                </Text>
              ) : null}

              {/* Napomena / opis */}
              <Text style={styles.napomenaTekst} numberOfLines={2}>
                📝 {item.opis_zadatka || 'Bez dodatnih napomena'}
              </Text>
            </View>

            {/* Desna strana: Akcije - Pozovi, Mapa, Edit, Briši */}
            <View style={styles.akcijeStupac}>
              {item.klijent_telefon ? (
                <TouchableOpacity
                  style={[styles.btnMalaAkcija, styles.btnPoziv]}
                  onPress={() => pozoviBroj(item.klijent_telefon)}
                >
                  <Text style={styles.btnAkcijaIkona}>📞</Text>
                </TouchableOpacity>
              ) : null}

              {item.lokacija ? (
                <TouchableOpacity
                  style={[styles.btnMalaAkcija, styles.btnMapa]}
                  onPress={() => otvoriNavigaciju(item.lokacija)}
                >
                  <Text style={styles.btnAkcijaIkona}>🗺️</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={[styles.btnMalaAkcija, styles.btnEdit]}
                onPress={() => onIzaberiPosao(item)}
              >
                <Text style={styles.btnAkcijaIkona}>✏️</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btnMalaAkcija, styles.btnBrisi]}
                onPress={() => {
                  Alert.alert(
                    'Brisanje termina',
                    'Da li ste sigurni da želite da obrišete ovaj zakazani posao?',
                    [
                      { text: 'Odustani', style: 'cancel' },
                      { text: 'Obriši', style: 'destructive', onPress: () => onObrisi(item.uuid_lokalni) }
                    ]
                  );
                }}
              >
                <Text style={styles.btnAkcijaIkona}>🗑️</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  listaKontejner: {
    padding: 14,
    paddingBottom: 110
  },
  zaglavljeTraka: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  zaglavljeNaslov: {
    fontSize: 13,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5
  },
  btnNoviMali: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: '#38BDF8',
    borderRadius: 6
  },
  btnNoviMaliTekst: {
    color: '#0F172A',
    fontWeight: 'bold',
    fontSize: 12
  },
  karticaRed: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155'
  },
  karticaRedZavrseno: {
    opacity: 0.6
  },
  ikonaOmotac: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  ikonaTekst: {
    fontSize: 20
  },
  redniBrojTekst: {
    fontSize: 9,
    color: '#38BDF8',
    fontWeight: '900'
  },
  srednjiDeo: {
    flex: 1,
    marginRight: 8
  },
  naslovRed: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  klijentIme: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F8FAFC',
    flex: 1,
    marginRight: 6
  },
  datumKreiranja: {
    fontSize: 11,
    color: '#64748B'
  },
  terminBedz: {
    backgroundColor: '#0F172A',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#38BDF8'
  },
  terminBedzTekst: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: 'bold'
  },
  infoTekst: {
    fontSize: 12,
    color: '#CBD5E1',
    marginBottom: 2
  },
  napomenaTekst: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2
  },
  akcijeStupac: {
    flexDirection: 'column',
    gap: 4
  },
  btnMalaAkcija: {
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center'
  },
  btnPoziv: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)'
  },
  btnMapa: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)'
  },
  btnEdit: {
    backgroundColor: '#334155'
  },
  btnBrisi: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)'
  },
  btnAkcijaIkona: {
    fontSize: 14
  },
  prazno: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    marginTop: 30
  },
  praznoIkona: {
    fontSize: 54,
    marginBottom: 12
  },
  praznoNaslov: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F8FAFC',
    marginBottom: 8
  },
  praznoTekst: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20
  },
  btnDodajPrazno: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#38BDF8',
    borderRadius: 8
  },
  btnDodajPraznoTekst: {
    color: '#0F172A',
    fontWeight: 'bold',
    fontSize: 14
  }
});
