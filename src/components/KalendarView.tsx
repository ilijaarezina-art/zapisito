import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking
} from 'react-native';
import { LokalniPodsetnik } from '../services/storage';

interface KalendarViewProps {
  podsetnici: LokalniPodsetnik[];
  onIzaberiPosao: (item: LokalniPodsetnik) => void;
  onZavrsiPosao: (uuid: string, trenutno: boolean) => void;
}

export default function KalendarView({ podsetnici, onIzaberiPosao, onZavrsiPosao }: KalendarViewProps) {
  const aktivni = podsetnici.filter(p => !p.je_zavrseno);

  const danas = new Date();
  danas.setHours(0, 0, 0, 0);

  const sutra = new Date(danas);
  sutra.setDate(sutra.getDate() + 1);

  const krajNedelje = new Date(danas);
  krajNedelje.setDate(krajNedelje.getDate() + 7);

  const posloviDanas: LokalniPodsetnik[] = [];
  const posloviSutraIOveNedelje: LokalniPodsetnik[] = [];
  const posloviKasnije: LokalniPodsetnik[] = [];
  const posloviBezRoka: LokalniPodsetnik[] = [];

  aktivni.forEach(p => {
    if (!p.rok_datum) {
      posloviBezRoka.push(p);
      return;
    }

    const d = new Date(p.rok_datum);
    d.setHours(0, 0, 0, 0);

    if (d.getTime() === danas.getTime()) {
      posloviDanas.push(p);
    } else if (d.getTime() > danas.getTime() && d.getTime() <= krajNedelje.getTime()) {
      posloviSutraIOveNedelje.push(p);
    } else if (d.getTime() > krajNedelje.getTime()) {
      posloviKasnije.push(p);
    } else {
      // Datum je u prošlosti ali posao nije završen -> prikazujemo u "Danas / Isteklo"
      posloviDanas.push(p);
    }
  });

  const otvoriNavigaciju = (lokacija: string) => {
    if (!lokacija) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lokacija)}`;
    Linking.openURL(url).catch(() => {});
  };

  const renderSekcija = (naslov: string, ikona: string, lista: LokalniPodsetnik[], boja: string) => {
    if (lista.length === 0) return null;

    return (
      <View style={styles.sekcija}>
        <View style={styles.sekcijaHeader}>
          <Text style={styles.sekcijaIkona}>{ikona}</Text>
          <Text style={[styles.sekcijaNaslov, { color: boja }]}>
            {naslov} ({lista.length})
          </Text>
        </View>

        {lista.map(item => {
          const datumString = item.rok_datum
            ? new Date(item.rok_datum).toLocaleDateString('sr-RS', { weekday: 'short', day: 'numeric', month: 'short' })
            : 'Bez roka';

          return (
            <View key={item.uuid_lokalni} style={[styles.posaoKartica, { borderLeftColor: boja }]}>
              <View style={styles.posaoGlavno}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.klijentIme}>
                    {item.klijent_ime || 'Posao bez imena'}
                  </Text>
                  <Text style={styles.opisZadatka} numberOfLines={2}>
                    {item.opis_zadatka || item.sirovi_tekst}
                  </Text>
                </View>

                {item.iznos > 0 && (
                  <View style={styles.iznosKutija}>
                    <Text style={styles.iznosVrednost}>
                      {item.iznos.toLocaleString('sr-RS')} {item.valuta}
                    </Text>
                    {item.je_kapara && <Text style={styles.kaparaOznaka}>KAPARA</Text>}
                  </View>
                )}
              </View>

              <View style={styles.posaoFooter}>
                <Text style={styles.datumBadge}>📅 {datumString}</Text>

                {item.lokacija ? (
                  <TouchableOpacity
                    style={styles.btnLokacija}
                    onPress={() => otvoriNavigaciju(item.lokacija)}
                  >
                    <Text style={styles.btnLokacijaTekst}>📍 {item.lokacija}</Text>
                  </TouchableOpacity>
                ) : null}

                <View style={{ flex: 1 }} />

                <TouchableOpacity
                  style={styles.btnDetalji}
                  onPress={() => onIzaberiPosao(item)}
                >
                  <Text style={styles.btnDetaljiTekst}>✏️ Izmeni</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.btnGotovo}
                  onPress={() => onZavrsiPosao(item.uuid_lokalni, item.je_zavrseno)}
                >
                  <Text style={styles.btnGotovoTekst}>✓ Gotovo</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  if (aktivni.length === 0) {
    return (
      <View style={styles.prazno}>
        <Text style={styles.praznoIkona}>📅</Text>
        <Text style={styles.praznoNaslov}>Nema zakazanih poslova</Text>
        <Text style={styles.praznoTekst}>
          Svi vaši poslovi su završeni ili lista je prazna. Pritisnite dugme "ZAPIŠI TO" da zakažete novi termin.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {renderSekcija('Danas na rasporedu (ili hitno)', '🔴', posloviDanas, '#EF4444')}
      {renderSekcija('Sutra i ove nedelje', '🔵', posloviSutraIOveNedelje, '#3B82F6')}
      {renderSekcija('Uskoro / Naredni period', '🟣', posloviKasnije, '#A855F7')}
      {renderSekcija('Po dogovoru (Fleksibilno)', '🟡', posloviBezRoka, '#F59E0B')}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 110,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center'
  },
  sekcija: {
    marginBottom: 20
  },
  sekcijaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10
  },
  sekcijaIkona: {
    fontSize: 18
  },
  sekcijaNaslov: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3
  },
  posaoKartica: {
    backgroundColor: '#181822',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#282838',
    borderLeftWidth: 4,
    padding: 14,
    marginBottom: 10
  },
  posaoGlavno: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12
  },
  klijentIme: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800'
  },
  opisZadatka: {
    color: '#D4D4D8',
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18
  },
  iznosKutija: {
    alignItems: 'flex-end',
    backgroundColor: '#0F261E',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#059669'
  },
  iznosVrednost: {
    color: '#34D399',
    fontSize: 14,
    fontWeight: '800'
  },
  kaparaOznaka: {
    color: '#FDE047',
    fontSize: 9,
    fontWeight: '900',
    marginTop: 2
  },
  posaoFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: '#242434'
  },
  datumBadge: {
    color: '#93C5FD',
    fontSize: 12,
    fontWeight: '700'
  },
  btnLokacija: {
    backgroundColor: '#272736',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  btnLokacijaTekst: {
    color: '#FCD34D',
    fontSize: 12,
    fontWeight: '600'
  },
  btnDetalji: {
    backgroundColor: '#272733',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#3F3F50'
  },
  btnDetaljiTekst: {
    color: '#E4E4E7',
    fontSize: 12,
    fontWeight: '700'
  },
  btnGotovo: {
    backgroundColor: '#065F46',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7
  },
  btnGotovoTekst: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800'
  },
  prazno: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center'
  },
  praznoIkona: {
    fontSize: 48,
    marginBottom: 16
  },
  praznoNaslov: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center'
  },
  praznoTekst: {
    color: '#71717A',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center'
  }
});
