import AsyncStorage from '@react-native-async-storage/async-storage';

export interface StavkaSpecifikacije {
  id?: string;
  br?: number;
  opis: string;
  jed_mere?: string;
  kolicina?: number | string;
  jed_cena?: number;
  iznos: number;
  valuta: 'RSD' | 'EUR';
  kupljeno?: boolean;
}

export interface LokalniPodsetnik {
  uuid_lokalni: string;
  server_id?: number;
  sirovi_tekst: string;
  naslov?: string;
  klijent_ime: string;
  klijent_telefon?: string | null;
  lokacija: string;
  iznos: number;
  valuta: 'RSD' | 'EUR';
  obracunaj_pdv?: boolean;
  pdv_procenat?: number;
  pdv_iznos?: number;
  ukupno_sa_pdv?: number;
  je_kapara: boolean;
  kapara_iznos?: number;
  rok_datum: string | null;
  opis_zadatka: string;
  napomene?: string;
  stavke?: StavkaSpecifikacije[];
  tip_zabelezke?: 'posao' | 'nabavka' | 'zakazano';
  je_zavrseno: boolean;
  kreirano_na_uredjaju: string;
  is_synced: boolean;
}

export interface LicencaCache {
  token_active: number;
  token_expires_at: string | null;
  besplatni_unosi_iskorisceno: number;
  poslednja_sinhronizacija: string; // ISO string
}

export interface KorisnikCache {
  id: number;
  role_id: number;
  role: string;
  korisnicko_ime: string;
  ime: string | null;
  token: string;
}

const STORAGE_KEYS = {
  PODSETNICI: 'zapisito_podsetnici_v1',
  LICENCA: 'zapisito_licenca_v1',
  KORISNIK: 'zapisito_korisnik_v1'
};

export const StorageService = {
  // Provera 72h offline pravila
  async proveriStatus72h(): Promise<{ isteklo72h: boolean; preostaloSati: number }> {
    const licenca = await this.getLicenca();
    if (!licenca || !licenca.poslednja_sinhronizacija) {
      // Ako nikada nije sinhronizovano, a nema tokena, zahtevamo internet
      return { isteklo72h: false, preostaloSati: 72 };
    }

    const sada = new Date().getTime();
    const zadnjiSync = new Date(licenca.poslednja_sinhronizacija).getTime();
    const prosloSati = (sada - zadnjiSync) / (1000 * 60 * 60);

    const preostalo = Math.max(0, 72 - prosloSati);
    return {
      isteklo72h: prosloSati > 72,
      preostaloSati: Math.round(preostalo * 10) / 10
    };
  },

  // Provera prava na unos (Pretplata ili 10 besplatnih)
  async daLiKorisnikMozeDaSacuva(): Promise<{ moze: boolean; razlog?: string }> {
    const status72 = await this.proveriStatus72h();
    if (status72.isteklo72h) {
      return {
        moze: false,
        razlog: 'Istekao je period rada bez interneta (72h). Povežite se na internet radi sinhronizacije i obnove licence.'
      };
    }

    const licenca = await this.getLicenca();
    if (!licenca) {
      return { moze: true }; // Novi unos pre prvog sync-a
    }

    const sada = new Date();
    const imaAktivnuPretplatu =
      licenca.token_active === 1 &&
      licenca.token_expires_at &&
      new Date(licenca.token_expires_at) > sada;

    if (imaAktivnuPretplatu) {
      return { moze: true };
    }

    // Provera besplatnih unosa
    if (licenca.besplatni_unosi_iskorisceno >= 10) {
      return {
        moze: false,
        razlog: 'Iskoristili ste svih 10 besplatnih unosa. Za neograničen rad kontaktirajte administratora za aktivaciju mesečne pretplate.'
      };
    }

    return { moze: true };
  },

  // Čuvanje podsetnika u lokalnoj bazi telefona
  async sacuvajPodsetnik(podsetnik: Omit<LokalniPodsetnik, 'uuid_lokalni' | 'is_synced' | 'kreirano_na_uredjaju'>): Promise<LokalniPodsetnik> {
    const provera = await this.daLiKorisnikMozeDaSacuva();
    if (!provera.moze) {
      throw new Error(provera.razlog);
    }

    const uuid = 'local_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    const novi: LokalniPodsetnik = {
      ...podsetnik,
      uuid_lokalni: uuid,
      is_synced: false,
      kreirano_na_uredjaju: new Date().toISOString()
    };

    const lista = await this.getSviPodsetnici();
    lista.unshift(novi);
    await AsyncStorage.setItem(STORAGE_KEYS.PODSETNICI, JSON.stringify(lista));

    // Ako korisnik nema pretplatu, uvećaj lokalni brojač
    const licenca = await this.getLicenca();
    if (licenca && licenca.token_active === 0) {
      licenca.besplatni_unosi_iskorisceno += 1;
      await this.sacuvajLicencu(licenca);
    }

    return novi;
  },

  async getSviPodsetnici(): Promise<LokalniPodsetnik[]> {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.PODSETNICI);
    return raw ? JSON.parse(raw) : [];
  },

  async azurirajPodsetnik(uuid: string, updates: Partial<LokalniPodsetnik>): Promise<void> {
    const lista = await this.getSviPodsetnici();
    const index = lista.findIndex(p => p.uuid_lokalni === uuid);
    if (index !== -1) {
      lista[index] = { ...lista[index], ...updates, is_synced: false };
      await AsyncStorage.setItem(STORAGE_KEYS.PODSETNICI, JSON.stringify(lista));
    }
  },

  async obrisiPodsetnik(uuid: string): Promise<void> {
    const lista = await this.getSviPodsetnici();
    const filtrirano = lista.filter(p => p.uuid_lokalni !== uuid);
    await AsyncStorage.setItem(STORAGE_KEYS.PODSETNICI, JSON.stringify(filtrirano));
  },

  async ocistiLokalnePodsetnike(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.PODSETNICI);
  },

  async spojiSaServerPodsetnicima(serverPodsetnici: LokalniPodsetnik[]): Promise<LokalniPodsetnik[]> {
    const lokalni = await this.getSviPodsetnici();
    const mapa = new Map<string, LokalniPodsetnik>();

    // 1. Stavi postojeće lokalne u mapu
    for (const p of lokalni) {
      mapa.set(p.uuid_lokalni, p);
    }

    // 2. Prođi kroz server unose i spoji
    for (const s of serverPodsetnici) {
      const postojeci = mapa.get(s.uuid_lokalni);
      if (!postojeci) {
        // Nije postojao lokalno na ovom uređaju — dodajemo ga sa servera
        mapa.set(s.uuid_lokalni, { ...s, is_synced: true });
      } else {
        // Postoji lokalno: ako je lokalni bio sinhronizovan, preuzmi najnovije sa servera
        if (postojeci.is_synced) {
          mapa.set(s.uuid_lokalni, { ...postojeci, ...s, is_synced: true });
        }
      }
    }

    const spojenaLista = Array.from(mapa.values());
    spojenaLista.sort((a, b) => {
      const da = new Date(a.kreirano_na_uredjaju).getTime() || 0;
      const db = new Date(b.kreirano_na_uredjaju).getTime() || 0;
      return db - da;
    });

    await AsyncStorage.setItem(STORAGE_KEYS.PODSETNICI, JSON.stringify(spojenaLista));
    return spojenaLista;
  },

  // Licenca i Korisnik
  async getLicenca(): Promise<LicencaCache | null> {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.LICENCA);
    return raw ? JSON.parse(raw) : null;
  },

  async sacuvajLicencu(licenca: LicencaCache): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.LICENCA, JSON.stringify(licenca));
  },

  async getKorisnik(): Promise<KorisnikCache | null> {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.KORISNIK);
    return raw ? JSON.parse(raw) : null;
  },

  async sacuvajKorisnika(korisnik: KorisnikCache): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.KORISNIK, JSON.stringify(korisnik));
  },

  async obrisiKorisnika(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.KORISNIK);
  }
};
