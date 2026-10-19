import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking
} from 'react-native';
import { LokalniPodsetnik } from '../services/storage';

interface NabavkaViewProps {
  podsetnici: LokalniPodsetnik[];
  onOtvoriEdit: (posao: LokalniPodsetnik) => void;
  onObrisi: (uuid: string) => void;
  onAzuriraj?: (azuriran: LokalniPodsetnik) => void;
}

export default function NabavkaView({
  podsetnici,
  onOtvoriEdit,
  onObrisi,
  onAzuriraj
}: NabavkaViewProps) {
  // Filtriramo dokumente tipa 'nabavka' i sortiramo po datumu kreiranja opadajuće (najnovije na vrhu)
  const nabavke = podsetnici
    .filter(
      p =>
        p.tip_zabelezke === 'nabavka' ||
        (!p.tip_zabelezke &&
          (p.stavke?.some(s => s.kupljeno !== undefined) ||
            p.opis_zadatka?.toLowerCase().includes('nabavk')))
    )
    .sort(
      (a, b) =>
        new Date(b.kreirano_na_uredjaju).getTime() -
        new Date(a.kreirano_na_uredjaju).getTime()
    );

  const toggleStavka = (nab: LokalniPodsetnik, itemIdx: number) => {
    if (!nab.stavke || !onAzuriraj) return;
    const noveStavke = [...nab.stavke];
    noveStavke[itemIdx] = {
      ...noveStavke[itemIdx],
      kupljeno: !noveStavke[itemIdx].kupljeno
    };
    const azuriran: LokalniPodsetnik = {
      ...nab,
      stavke: noveStavke
    };
    onAzuriraj(azuriran);
  };

  const podeliNaWhatsApp = (nab: LokalniPodsetnik) => {
    if (!nab.stavke || nab.stavke.length === 0) return;
    const naslovListe =
      nab.naslov &&
      !nab.naslov.includes('Građevinsk') &&
      !nab.naslov.includes('Specifikacija')
        ? nab.naslov
        : 'Nabavka';

    let tekst = `🛒 *${naslovListe.toUpperCase()}*\n`;
    tekst += `📅 ${new Date(nab.kreirano_na_uredjaju).toLocaleDateString('sr-RS')}\n`;
    tekst += `--------------------------------\n`;

    nab.stavke.forEach(s => {
      const mark = s.kupljeno ? '✅' : '⬜';
      tekst += `${mark} *${s.opis}* - ${s.kolicina || '1 kom'}\n`;
    });

    const kupljeno = nab.stavke.filter(s => s.kupljeno).length;
    tekst += `--------------------------------\n`;
    tekst += `Stanje: ${kupljeno}/${nab.stavke.length} kupljeno`;

    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(tekst)}`).catch(() => {
      Alert.alert('Info', 'Nije uspelo otvaranje WhatsApp-a.');
    });
  };

  if (nabavke.length === 0) {
    return (
      <View style={styles.prazno}>
        <View style={styles.praznoIkonaKrug}>
          <Text style={styles.praznoIkona}>🛒</Text>
        </View>
        <Text style={styles.praznoNaslov}>Nemate sačuvanih lista za nabavku</Text>
        <Text style={styles.praznoTekst}>
          Pritisnite dugme "Zapiši nabavku (govor)" na dnu ekrana i izdiktirajte namirnice (npr. "Jabuke 2kg, Banane 1 kg, kafa 200gr, mleko 1 litar"). Aplikacija će automatski formirati listu!
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.listaKontejner}>
      <View style={styles.zaglavljeTraka}>
        <Text style={styles.zaglavljeNaslov}>LISTE ZA NABAVKU ({nabavke.length})</Text>
        <Text style={styles.zaglavljePod}>Dodirnite stavku za čekiranje dok kupujete</Text>
      </View>

      {/* Prikaz svake liste kao moderna svetlija kartica */}
      {nabavke.map((nab, idx) => {
        const ukupnoStavki = nab.stavke ? nab.stavke.length : 0;
        const kupljenoStavki = nab.stavke
          ? nab.stavke.filter(s => s.kupljeno).length
          : 0;
        const procenat =
          ukupnoStavki > 0 ? Math.round((kupljenoStavki / ukupnoStavki) * 100) : 0;
        const jeSveKupljeno = ukupnoStavki > 0 && kupljenoStavki === ukupnoStavki;

        const datumStr = new Date(nab.kreirano_na_uredjaju).toLocaleDateString(
          'sr-RS',
          {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
          }
        );

        const naslovPrikaz =
          nab.naslov &&
          !nab.naslov.includes('Građevinsk') &&
          !nab.naslov.includes('Specifikacija')
            ? nab.naslov
            : 'Nabavka';

        return (
          <View
            key={nab.uuid_lokalni}
            style={[styles.kartica, jeSveKupljeno && styles.karticaSveKupljeno]}
          >
            {/* Gornji red: Ikona, Naslov, Datum i Akcije */}
            <View style={styles.karticaHeader}>
              <View style={styles.ikonaOmotac}>
                <Text style={styles.ikonaTekst}>🛒</Text>
                <Text style={styles.redniBrojTekst}>#{idx + 1}</Text>
              </View>

              <View style={styles.naslovOmotac}>
                <Text style={styles.naslovListe} numberOfLines={1}>
                  {naslovPrikaz}
                </Text>
                <Text style={styles.datumTekst}>{datumStr}</Text>
              </View>

              {/* Dugmad za akcije */}
              <View style={styles.akcijeGore}>
                <TouchableOpacity
                  style={styles.btnAkcijaMala}
                  onPress={() => podeliNaWhatsApp(nab)}
                  title="Podeli na WhatsApp"
                >
                  <Text style={styles.btnAkcijaTekst}>💬</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.btnAkcijaMala}
                  onPress={() => onOtvoriEdit(nab)}
                  title="Izmeni listu"
                >
                  <Text style={styles.btnAkcijaTekst}>✏️</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btnAkcijaMala, styles.btnAkcijaBrisi]}
                  onPress={(e: any) => {
                    e?.stopPropagation?.();
                    onObrisi(nab.uuid_lokalni);
                  }}
                  title="Obriši listu"
                >
                  <Text style={styles.btnAkcijaTekst}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Traka napretka (Progres bar - Bring! stil) */}
            <View style={styles.progresKontejner}>
              <View style={styles.progresPozadina}>
                <View
                  style={[
                    styles.progresPopunjeno,
                    { width: `${procenat}%` },
                    jeSveKupljeno && { backgroundColor: '#10B981' }
                  ]}
                />
              </View>
              <Text
                style={[
                  styles.statusTekst,
                  jeSveKupljeno && { color: '#059669', fontWeight: '800' }
                ]}
              >
                {jeSveKupljeno
                  ? '✓ Sve kupljeno!'
                  : `${kupljenoStavki}/${ukupnoStavki} kupljeno (${procenat}%)`}
              </Text>
            </View>

            {/* Interaktivna lista stavki direktno na kartici */}
            {nab.stavke && nab.stavke.length > 0 ? (
              <View style={styles.stavkeMreza}>
                {nab.stavke.map((st, sIdx) => {
                  const kupljena = !!st.kupljeno;
                  return (
                    <TouchableOpacity
                      key={sIdx}
                      style={[
                        styles.stavkaCip,
                        kupljena && styles.stavkaCipKupljena
                      ]}
                      activeOpacity={0.7}
                      onPress={() => toggleStavka(nab, sIdx)}
                    >
                      <View
                        style={[
                          styles.checkboxKvadrat,
                          kupljena && styles.checkboxKvadratOznacen
                        ]}
                      >
                        {kupljena ? (
                          <Text style={styles.kvacicaTekst}>✓</Text>
                        ) : null}
                      </View>
                      <Text
                        style={[
                          styles.stavkaNaziv,
                          kupljena && styles.stavkaNazivPrecrtano
                        ]}
                        numberOfLines={1}
                      >
                        {st.opis}
                      </Text>
                      {st.kolicina ? (
                        <Text
                          style={[
                            styles.stavkaKolicina,
                            kupljena && styles.stavkaKolicinaPrecrtano
                          ]}
                        >
                          {st.kolicina}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.praznoStavkiTekst}>
                {nab.opis_zadatka || 'Nema stavki u listi'}
              </Text>
            )}

            {/* Donje dugme za otvaranje celog lista */}
            <TouchableOpacity
              style={styles.btnDetalji}
              onPress={() => onOtvoriEdit(nab)}
            >
              <Text style={styles.btnDetaljiTekst}>
                ✏️ Otvori ceo list papira & izmeni stavke →
              </Text>
            </TouchableOpacity>
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
  karticaSveKupljeno: {
    borderColor: '#A7F3D0',
    backgroundColor: '#F0FDF4'
  },
  karticaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10
  },
  ikonaOmotac: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10
  },
  ikonaTekst: {
    fontSize: 18
  },
  redniBrojTekst: {
    fontSize: 9,
    color: '#059669',
    fontWeight: '900'
  },
  naslovOmotac: {
    flex: 1,
    marginRight: 6
  },
  naslovListe: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A'
  },
  datumTekst: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2
  },
  akcijeGore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  btnAkcijaMala: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center'
  },
  btnAkcijaBrisi: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FEE2E2'
  },
  btnAkcijaTekst: {
    fontSize: 14
  },
  progresKontejner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  progresPozadina: {
    flex: 1,
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden'
  },
  progresPopunjeno: {
    height: '100%',
    backgroundColor: '#0284C7',
    borderRadius: 3
  },
  statusTekst: {
    fontSize: 12,
    color: '#0369A1',
    fontWeight: '700'
  },
  stavkeMreza: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10
  },
  stavkaCip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: '100%'
  },
  stavkaCipKupljena: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
    opacity: 0.65
  },
  checkboxKvadrat: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6
  },
  checkboxKvadratOznacen: {
    backgroundColor: '#10B981',
    borderColor: '#10B981'
  },
  kvacicaTekst: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900'
  },
  stavkaNaziv: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
    marginRight: 6
  },
  stavkaNazivPrecrtano: {
    textDecorationLine: 'line-through',
    color: '#64748B'
  },
  stavkaKolicina: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  stavkaKolicinaPrecrtano: {
    color: '#94A3B8',
    backgroundColor: '#E2E8F0',
    textDecorationLine: 'line-through'
  },
  praznoStavkiTekst: {
    fontSize: 13,
    color: '#64748B',
    fontStyle: 'italic',
    marginBottom: 8
  },
  btnDetalji: {
    paddingVertical: 8,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: 2
  },
  btnDetaljiTekst: {
    fontSize: 12,
    color: '#0284C7',
    fontWeight: '700'
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
