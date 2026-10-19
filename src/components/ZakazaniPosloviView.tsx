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
    .sort(
      (a, b) =>
        new Date(b.kreirano_na_uredjaju).getTime() -
        new Date(a.kreirano_na_uredjaju).getTime()
    );

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

  const posaljiPotvrduTermina = (item: LokalniPodsetnik) => {
    const datumTermina = item.rok_datum
      ? new Date(item.rok_datum).toLocaleDateString('sr-RS', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          hour: '2-digit',
          minute: '2-digit'
        })
      : 'uskoro';

    const ime = item.klijent_ime ? ` ${item.klijent_ime}` : '';
    const adresa = item.lokacija ? ` na adresi ${item.lokacija}` : '';
    const posao = item.opis_zadatka ? ` za radove: "${item.opis_zadatka}"` : '';

    const poruka = `Pozdrav${ime}, potvrđujem zakazani termin${adresa} u terminu: ${datumTermina}${posao}.\nVidimo se!`;

    if (item.klijent_telefon) {
      let tel = item.klijent_telefon.replace(/[\s\-\/]/g, '');
      if (tel.startsWith('06')) tel = '381' + tel.slice(1);
      if (tel.startsWith('+')) tel = tel.slice(1);
      Linking.openURL(`https://wa.me/${tel}?text=${encodeURIComponent(poruka)}`).catch(() => {
        Linking.openURL(`sms:${item.klijent_telefon}?body=${encodeURIComponent(poruka)}`);
      });
    } else {
      Linking.openURL(`https://wa.me/?text=${encodeURIComponent(poruka)}`).catch(() => {});
    }
  };

  const jeTerminDanas = (rokDatum?: string | null) => {
    if (!rokDatum) return false;
    const d = new Date(rokDatum);
    const danas = new Date();
    return (
      d.getDate() === danas.getDate() &&
      d.getMonth() === danas.getMonth() &&
      d.getFullYear() === danas.getFullYear()
    );
  };

  if (zakazani.length === 0) {
    return (
      <View style={styles.prazno}>
        <View style={styles.praznoIkonaKrug}>
          <Text style={styles.praznoIkona}>📅</Text>
        </View>
        <Text style={styles.praznoNaslov}>Nemate zakazanih poslova</Text>
        <Text style={styles.praznoTekst}>
          Pritisnite dugme "Zakaži termin (govor)" na dnu ekrana i izdiktirajte termin (npr. "Jovan Petrović, 064 123 4567, Smederevo Knez Mihailova 12, sutra u 10 sati, krečenje stana").
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.listaKontejner}>
      <View style={styles.zaglavljeTraka}>
        <Text style={styles.zaglavljeNaslov}>ZAKAZANI POSLOVI I TERMINI ({zakazani.length})</Text>
        <Text style={styles.zaglavljePod}>One-Tap akcije za direktan poziv, poruku i navigaciju</Text>
      </View>

      {zakazani.map((item, idx) => {
        const jeDanas = jeTerminDanas(item.rok_datum);
        const datumTerminaStr = item.rok_datum
          ? new Date(item.rok_datum).toLocaleDateString('sr-RS', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit'
            })
          : 'Termin nije definisan';

        const datumKreiranjaStr = new Date(item.kreirano_na_uredjaju).toLocaleDateString(
          'sr-RS',
          {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
          }
        );

        return (
          <View
            key={item.uuid_lokalni}
            style={[
              styles.kartica,
              jeDanas && styles.karticaDanas,
              item.je_zavrseno && styles.karticaZavrseno
            ]}
          >
            {/* Gornji red: Ikona, Klijent, Termin bedž i Završi dugme */}
            <View style={styles.karticaGore}>
              <View style={[styles.ikonaOmotac, jeDanas && styles.ikonaOmotacDanas]}>
                <Text style={styles.ikonaTekst}>📅</Text>
                <Text style={[styles.redniBrojTekst, jeDanas && { color: '#DC2626' }]}>
                  #{idx + 1}
                </Text>
              </View>

              <View style={styles.klijentInfoOmotac}>
                <View style={styles.imeTerminRed}>
                  <Text style={styles.klijentIme} numberOfLines={1}>
                    {item.klijent_ime || 'Klijent (nije navedeno ime)'}
                  </Text>
                  <Text style={styles.datumKreiranja}>{datumKreiranjaStr}</Text>
                </View>

                {/* Termin Bedž */}
                <View style={[styles.terminBedz, jeDanas && styles.terminBedzDanas]}>
                  <Text style={[styles.terminBedzTekst, jeDanas && styles.terminBedzTekstDanas]}>
                    ⏰ {jeDanas ? 'DANAS: ' : ''}{datumTerminaStr}
                  </Text>
                </View>
              </View>

              {/* Status Završeno dugme */}
              <TouchableOpacity
                style={[
                  styles.btnStatusZavrseno,
                  item.je_zavrseno && styles.btnStatusZavrsenoAktivno
                ]}
                onPress={() => onZavrsiPosao(item.uuid_lokalni, item.je_zavrseno)}
                title={item.je_zavrseno ? 'Vrati u aktivne' : 'Označi kao završeno'}
              >
                <Text style={styles.btnStatusZavrsenoTekst}>
                  {item.je_zavrseno ? '✅ Završen' : '⏳ U toku'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Srednji detalji: Adresa, Telefon, Opis posla */}
            <View style={styles.detaljiKontejner}>
              {item.lokacija ? (
                <View style={styles.detaljRed}>
                  <Text style={styles.detaljIkona}>📍</Text>
                  <Text style={styles.detaljTekst} numberOfLines={1}>
                    {item.lokacija}
                  </Text>
                </View>
              ) : null}

              {item.klijent_telefon ? (
                <View style={styles.detaljRed}>
                  <Text style={styles.detaljIkona}>📞</Text>
                  <Text style={styles.detaljTekst} numberOfLines={1}>
                    {item.klijent_telefon}
                  </Text>
                </View>
              ) : null}

              {item.opis_zadatka ? (
                <View style={styles.detaljRed}>
                  <Text style={styles.detaljIkona}>📝</Text>
                  <Text style={styles.detaljOpisTekst} numberOfLines={2}>
                    {item.opis_zadatka}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* ONE-TAP AKCIJE (Jobber / Housecall Pro Benchmark) */}
            <View style={styles.oneTapAkcijeRed}>
              {/* 1. POZOVI */}
              <TouchableOpacity
                style={[styles.btnOneTap, styles.btnPozovi, !item.klijent_telefon && styles.btnOnTapDeaktiviran]}
                onPress={() => pozoviBroj(item.klijent_telefon)}
                disabled={!item.klijent_telefon}
              >
                <Text style={styles.btnOneTapTekst}>📞 Pozovi</Text>
              </TouchableOpacity>

              {/* 2. POTVRDI TERMIN (WhatsApp / SMS) */}
              <TouchableOpacity
                style={[styles.btnOneTap, styles.btnPoruka]}
                onPress={() => posaljiPotvrduTermina(item)}
              >
                <Text style={styles.btnOneTapTekst}>💬 Potvrdi termin</Text>
              </TouchableOpacity>

              {/* 3. NAVIGACIJA */}
              <TouchableOpacity
                style={[styles.btnOneTap, styles.btnNavigacija, !item.lokacija && styles.btnOnTapDeaktiviran]}
                onPress={() => otvoriNavigaciju(item.lokacija)}
                disabled={!item.lokacija}
              >
                <Text style={styles.btnOneTapTekst}>🗺️ Navigacija</Text>
              </TouchableOpacity>

              {/* 4. IZMENI */}
              <TouchableOpacity
                style={styles.btnOneTapIkona}
                onPress={() => onIzaberiPosao(item)}
                title="Izmeni radni nalog"
              >
                <Text style={styles.btnOneTapIkonaTekst}>✏️</Text>
              </TouchableOpacity>

              {/* 5. OBRIŠI */}
              <TouchableOpacity
                style={[styles.btnOneTapIkona, styles.btnOneTapBrisi]}
                onPress={(e: any) => {
                  e?.stopPropagation?.();
                  onObrisi(item.uuid_lokalni);
                }}
                title="Obriši termin"
              >
                <Text style={styles.btnOneTapIkonaTekst}>🗑️</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  listaKontejner: {
    padding: 16,
    paddingBottom: 120,
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center'
  },
  zaglavljeTraka: {
    marginBottom: 14
  },
  zaglavljeNaslov: {
    fontSize: 14,
    fontWeight: '800',
    color: '#334155',
    letterSpacing: 0.5
  },
  zaglavljePod: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2
  },
  kartica: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2
  },
  karticaDanas: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2'
  },
  karticaZavrseno: {
    opacity: 0.7,
    backgroundColor: '#F8FAFC'
  },
  karticaGore: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  ikonaOmotac: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10
  },
  ikonaOmotacDanas: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA'
  },
  ikonaTekst: {
    fontSize: 18
  },
  redniBrojTekst: {
    fontSize: 9,
    color: '#4F46E5',
    fontWeight: '900'
  },
  klijentInfoOmotac: {
    flex: 1,
    marginRight: 8
  },
  imeTerminRed: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  klijentIme: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
    marginRight: 6
  },
  datumKreiranja: {
    fontSize: 11,
    color: '#64748B'
  },
  terminBedz: {
    alignSelf: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  terminBedzDanas: {
    backgroundColor: '#DC2626',
    borderColor: '#B91C1C'
  },
  terminBedzTekst: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8'
  },
  terminBedzTekstDanas: {
    color: '#FFFFFF'
  },
  btnStatusZavrseno: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1'
  },
  btnStatusZavrsenoAktivno: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0'
  },
  btnStatusZavrsenoTekst: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155'
  },
  detaljiKontejner: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 4
  },
  detaljRed: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  detaljIkona: {
    fontSize: 13,
    marginRight: 6
  },
  detaljTekst: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
    flex: 1
  },
  detaljOpisTekst: {
    fontSize: 13,
    color: '#475569',
    fontStyle: 'italic',
    flex: 1
  },
  oneTapAkcijeRed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  btnOneTap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8
  },
  btnPozovi: {
    backgroundColor: '#10B981'
  },
  btnPoruka: {
    backgroundColor: '#2563EB'
  },
  btnNavigacija: {
    backgroundColor: '#7C3AED'
  },
  btnOnTapDeaktiviran: {
    opacity: 0.35
  },
  btnOneTapTekst: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 11
  },
  btnOneTapIkona: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center'
  },
  btnOneTapBrisi: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FEE2E2'
  },
  btnOneTapIkonaTekst: {
    fontSize: 14
  },
  prazno: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    marginTop: 40
  },
  praznoIkonaKrug: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16
  },
  praznoIkona: {
    fontSize: 38
  },
  praznoNaslov: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 8
  },
  praznoTekst: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 380
  }
});
