import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert
} from 'react-native';
import { LokalniPodsetnik } from '../services/storage';

interface NabavkaViewProps {
  podsetnici: LokalniPodsetnik[];
  onOtvoriEdit: (posao: LokalniPodsetnik) => void;
  onObrisi: (uuid: string) => void;
  onDodajNovuNabavku: () => void;
}

export default function NabavkaView({
  podsetnici,
  onOtvoriEdit,
  onObrisi,
  onDodajNovuNabavku
}: NabavkaViewProps) {
  // Filtriramo dokumente tipa 'nabavka' i sortiramo po datumu kreiranja opadajuće (najnovije na vrhu)
  const nabavke = podsetnici
    .filter(p => p.tip_zabelezke === 'nabavka' || (!p.tip_zabelezke && (p.stavke?.some(s => s.kupljeno !== undefined) || p.opis_zadatka?.toLowerCase().includes('nabavk'))))
    .sort((a, b) => new Date(b.kreirano_na_uredjaju).getTime() - new Date(a.kreirano_na_uredjaju).getTime());

  if (nabavke.length === 0) {
    return (
      <View style={styles.prazno}>
        <Text style={styles.praznoIkona}>🛒</Text>
        <Text style={styles.praznoNaslov}>Nemate sačuvanih lista za nabavku</Text>
        <Text style={styles.praznoTekst}>
          Kliknite na mikrofon ili dugme ispod i izdiktirajte namirnice (npr. "Jabuke 2kg, Banane 1 kg, kafa 200gr"). Aplikacija će automatski napraviti tabelu za kupovinu!
        </Text>
        <TouchableOpacity style={styles.btnDodajPrazno} onPress={onDodajNovuNabavku}>
          <Text style={styles.btnDodajPraznoTekst}>🎙️ Izdiktiraj novu nabavku</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.listaKontejner}>
      <View style={styles.zaglavljeTraka}>
        <Text style={styles.zaglavljeNaslov}>LISTE ZA NABAVKU ({nabavke.length})</Text>
        <TouchableOpacity style={styles.btnNovaNabavkaMala} onPress={onDodajNovuNabavku}>
          <Text style={styles.btnNovaNabavkaMalaTekst}>+ Nova lista</Text>
        </TouchableOpacity>
      </View>

      {/* Prikaz svake liste kao jedan čist red, najnovije na vrhu */}
      {nabavke.map((nab, idx) => {
        const ukupnoStavki = nab.stavke ? nab.stavke.length : 0;
        const kupljenoStavki = nab.stavke ? nab.stavke.filter(s => s.kupljeno).length : 0;
        const procenat = ukupnoStavki > 0 ? Math.round((kupljenoStavki / ukupnoStavki) * 100) : 0;
        const datumStr = new Date(nab.kreirano_na_uredjaju).toLocaleDateString('sr-RS', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit'
        });

        // Sažetak namirnica
        const sazetak = nab.stavke && nab.stavke.length > 0
          ? nab.stavke.map(s => `${s.opis} ${s.kolicina ? `(${s.kolicina})` : ''}`).slice(0, 3).join(', ') + (nab.stavke.length > 3 ? ` i još ${nab.stavke.length - 3}` : '')
          : nab.opis_zadatka;

        return (
          <TouchableOpacity
            key={nab.uuid_lokalni}
            style={styles.redKartica}
            activeOpacity={0.8}
            onPress={() => onOtvoriEdit(nab)}
          >
            {/* Leva strana: Ikona i Redni broj */}
            <View style={styles.ikonaOmotac}>
              <Text style={styles.ikonaTekst}>🛒</Text>
              <Text style={styles.redniBrojTekst}>#{idx + 1}</Text>
            </View>

            {/* Sredina: Naziv, sažetak stavki i datum */}
            <View style={styles.srednjiDeo}>
              <View style={styles.naslovRed}>
                <Text style={styles.naslovListe} numberOfLines={1}>
                  {nab.naslov || `Nabavka #${nab.uuid_lokalni.slice(-4)}`}
                </Text>
                <Text style={styles.datumTekst}>{datumStr}</Text>
              </View>

              <Text style={styles.sazetakTekst} numberOfLines={1}>
                {sazetak}
              </Text>

              {/* Status traka */}
              <View style={styles.statusRed}>
                <View style={styles.progresPozadina}>
                  <View style={[styles.progresPopunjeno, { width: `${procenat}%` }]} />
                </View>
                <Text style={styles.statusTekst}>
                  {kupljenoStavki}/{ukupnoStavki} kupljeno ({procenat}%)
                </Text>
              </View>
            </View>

            {/* Desna strana: Dugme za edit (olovka) i brisanje */}
            <View style={styles.akcijeKontejner}>
              <TouchableOpacity
                style={styles.btnAkcijaEdit}
                onPress={() => onOtvoriEdit(nab)}
              >
                <Text style={styles.btnAkcijaTekst}>✏️</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.btnAkcijaBrisi}
                onPress={() => {
                  Alert.alert(
                    'Brisanje nabavke',
                    'Da li ste sigurni da želite da obrišete ovu listu za nabavku?',
                    [
                      { text: 'Odustani', style: 'cancel' },
                      { text: 'Obriši', style: 'destructive', onPress: () => onObrisi(nab.uuid_lokalni) }
                    ]
                  );
                }}
              >
                <Text style={styles.btnAkcijaTekst}>🗑️</Text>
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
  btnNovaNabavkaMala: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: '#10B981',
    borderRadius: 6
  },
  btnNovaNabavkaMalaTekst: {
    color: '#0F172A',
    fontWeight: 'bold',
    fontSize: 12
  },
  redKartica: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155'
  },
  ikonaOmotac: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  ikonaTekst: {
    fontSize: 20
  },
  redniBrojTekst: {
    fontSize: 9,
    color: '#10B981',
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
    marginBottom: 2
  },
  naslovListe: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
    flex: 1,
    marginRight: 6
  },
  datumTekst: {
    fontSize: 11,
    color: '#64748B'
  },
  sazetakTekst: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 6
  },
  statusRed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  progresPozadina: {
    width: 60,
    height: 5,
    backgroundColor: '#334155',
    borderRadius: 3,
    overflow: 'hidden'
  },
  progresPopunjeno: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 3
  },
  statusTekst: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '600'
  },
  akcijeKontejner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  btnAkcijaEdit: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center'
  },
  btnAkcijaBrisi: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  btnAkcijaTekst: {
    fontSize: 15
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
    backgroundColor: '#10B981',
    borderRadius: 8
  },
  btnDodajPraznoTekst: {
    color: '#0F172A',
    fontWeight: 'bold',
    fontSize: 14
  }
});
