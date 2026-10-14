import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  Platform
} from 'react-native';
import { LokalniPodsetnik } from '../services/storage';

interface ZakazaniPosloviViewProps {
  podsetnici: LokalniPodsetnik[];
  onIzaberiPosao: (item: LokalniPodsetnik) => void;
  onZavrsiPosao: (uuid: string, trenutno: boolean) => void;
  onDodajZakazani: () => void;
}

export default function ZakazaniPosloviView({
  podsetnici,
  onIzaberiPosao,
  onZavrsiPosao,
  onDodajZakazani
}: ZakazaniPosloviViewProps) {
  const aktivni = podsetnici.filter(p => !p.je_zavrseno);

  const danas = new Date();
  danas.setHours(0, 0, 0, 0);

  const sutra = new Date(danas);
  sutra.setDate(sutra.getDate() + 1);

  const krajNedelje = new Date(danas);
  krajNedelje.setDate(krajNedelje.getDate() + 7);

  const posloviDanas: LokalniPodsetnik[] = [];
  const posloviOveNedelje: LokalniPodsetnik[] = [];
  const posloviKasnije: LokalniPodsetnik[] = [];
  const posloviBezDatuma: LokalniPodsetnik[] = [];

  aktivni.forEach(p => {
    if (!p.rok_datum) {
      posloviBezDatuma.push(p);
      return;
    }

    const d = new Date(p.rok_datum);
    d.setHours(0, 0, 0, 0);

    if (d.getTime() === danas.getTime()) {
      posloviDanas.push(p);
    } else if (d.getTime() > danas.getTime() && d.getTime() <= krajNedelje.getTime()) {
      posloviOveNedelje.push(p);
    } else if (d.getTime() > krajNedelje.getTime()) {
      posloviKasnije.push(p);
    } else {
      // Datum je istekao a posao nije završen
      posloviDanas.push(p);
    }
  });

  const pozoviBroj = (broj?: string | null) => {
    if (!broj) return;
    Linking.openURL(`tel:${broj}`).catch(() => {});
  };

  const otvoriNavigaciju = (lokacija?: string) => {
    if (!lokacija) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lokacija)}`;
    Linking.openURL(url).catch(() => {});
  };

  const renderGrupa = (naslov: string, ikona: string, stavke: LokalniPodsetnik[], boja: string) => {
    if (stavke.length === 0) return null;

    return (
      <View style={styles.grupaKutija}>
        <View style={styles.grupaHeader}>
          <Text style={[styles.grupaNaslov, { color: boja }]}>
            {ikona} {naslov} ({stavke.length})
          </Text>
        </View>

        <View style={styles.grupaLista}>
          {stavke.map(item => {
            const datumStr = item.rok_datum
              ? new Date(item.rok_datum).toLocaleDateString('sr-RS', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit'
                })
              : 'Bez definisanog termina';

            return (
              <View key={item.uuid_lokalni} style={styles.kartica}>
                {/* Zaglavlje kartice */}
                <View style={styles.karticaTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.klijentIme}>
                      👤 {item.klijent_ime || 'Nepoznat klijent'}
                    </Text>
                    <Text style={styles.terminTekst}>🕒 {datumStr}</Text>
                  </View>

                  <View style={styles.akcijeBrze}>
                    <TouchableOpacity
                      style={styles.btnOlovka}
                      onPress={() => onIzaberiPosao(item)}
                    >
                      <Text style={styles.btnOlovkaTekst}>✏️</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.btnZavrsi}
                      onPress={() => onZavrsiPosao(item.uuid_lokalni, item.je_zavrseno)}
                    >
                      <Text style={styles.btnZavrsiTekst}>✓</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Detalji posla i napomena */}
                <View style={styles.detaljiKontejner}>
                  <Text style={styles.vrstaPoslaTekst}>
                    🔨 <Text style={{ fontWeight: '700', color: '#F4F4F5' }}>Vrsta posla:</Text>{' '}
                    {item.opis_zadatka}
                  </Text>

                  {item.klijent_telefon ? (
                    <TouchableOpacity
                      style={styles.redKontakt}
                      onPress={() => pozoviBroj(item.klijent_telefon)}
                    >
                      <Text style={styles.kontaktTekst}>
                        📞 <Text style={styles.kontaktLink}>{item.klijent_telefon}</Text> (Pozovi)
                      </Text>
                    </TouchableOpacity>
                  ) : null}

                  {item.lokacija ? (
                    <TouchableOpacity
                      style={styles.redKontakt}
                      onPress={() => otvoriNavigaciju(item.lokacija)}
                    >
                      <Text style={styles.kontaktTekst}>
                        📍 <Text style={styles.kontaktLink}>{item.lokacija}</Text> 🗺️ (Navigacija)
                      </Text>
                    </TouchableOpacity>
                  ) : null}

                  {item.iznos > 0 ? (
                    <View style={styles.sumaRed}>
                      <Text style={styles.sumaOznaka}>
                        {item.je_kapara ? '🟡 Avans/Kapara:' : '💰 Dogovoreno:'}
                      </Text>
                      <Text style={styles.sumaVrednost}>
                        {item.iznos.toLocaleString()} {item.valuta}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  if (aktivni.length === 0) {
    return (
      <View style={styles.prazno}>
        <Text style={styles.praznoIkona}>📅</Text>
        <Text style={styles.praznoNaslov}>Nema zakazanih poslova</Text>
        <Text style={styles.praznoTekst}>
          Izdiktirajte novi zakazani posao glasom (npr. "Sutra u 10h kod Marka Petrovića, 0641234567, Smederevo, krečenje stana").
        </Text>
        <TouchableOpacity style={styles.btnDodajPrazno} onPress={onDodajZakazani}>
          <Text style={styles.btnDodajPraznoTekst}>🎙️ Zakaži novi posao</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {renderGrupa('Danas & Hitno', '🔴', posloviDanas, '#EF4444')}
      {renderGrupa('Ove nedelje', '🟡', posloviOveNedelje, '#F59E0B')}
      {renderGrupa('Kasniji termini', '🔵', posloviKasnije, '#38BDF8')}
      {renderGrupa('Nezakazani radovi', '⚪', posloviBezDatuma, '#A1A1AA')}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 110, maxWidth: 900, width: '100%', alignSelf: 'center' },
  prazno: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, marginTop: 60 },
  praznoIkona: { fontSize: 64, marginBottom: 16 },
  praznoNaslov: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', marginBottom: 8, textAlign: 'center' },
  praznoTekst: { fontSize: 14, color: '#A1A1AA', textAlign: 'center', lineHeight: 22, maxWidth: 440, marginBottom: 20 },
  btnDodajPrazno: { backgroundColor: '#38BDF8', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12 },
  btnDodajPraznoTekst: { color: '#0F172A', fontSize: 15, fontWeight: '800' },
  grupaKutija: { marginBottom: 20 },
  grupaHeader: { marginBottom: 10 },
  grupaNaslov: { fontSize: 17, fontWeight: '800', letterSpacing: 0.5 },
  grupaLista: { gap: 12 },
  kartica: {
    backgroundColor: '#1E1E24',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2A2A35'
  },
  karticaTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#272730',
    paddingBottom: 12,
    marginBottom: 12
  },
  klijentIme: { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
  terminTekst: { fontSize: 13, color: '#38BDF8', marginTop: 4, fontWeight: '700' },
  akcijeBrze: { flexDirection: 'row', gap: 8 },
  btnOlovka: { backgroundColor: '#272730', padding: 8, borderRadius: 8 },
  btnOlovkaTekst: { fontSize: 16 },
  btnZavrsi: {
    backgroundColor: '#059669',
    width: 34,
    height: 34,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center'
  },
  btnZavrsiTekst: { color: '#FFFFFF', fontWeight: '900', fontSize: 18 },
  detaljiKontejner: { gap: 8 },
  vrstaPoslaTekst: { fontSize: 14, color: '#CBD5E1', lineHeight: 20 },
  redKontakt: { paddingVertical: 2 },
  kontaktTekst: { fontSize: 14, color: '#94A3B8' },
  kontaktLink: { color: '#38BDF8', fontWeight: '700', textDecorationLine: 'underline' },
  sumaRed: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#272730',
    padding: 10,
    borderRadius: 8,
    marginTop: 6
  },
  sumaOznaka: { fontSize: 13, color: '#CBD5E1', fontWeight: '600' },
  sumaVrednost: { fontSize: 14, color: '#34D399', fontWeight: '800' }
});
