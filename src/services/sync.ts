import { StorageService, LokalniPodsetnik, LicencaCache } from './storage';

// LIVE SERVER API URL
export const DEFAULT_API_URL = 'https://bookmymusic.rs/zapisito/api.php';

export const SyncService = {
  async izvrsiSinhronizaciju(apiUrl: string = DEFAULT_API_URL): Promise<{ uspeh: boolean; poruka: string; greska?: string }> {
    try {
      const korisnik = await StorageService.getKorisnik();
      if (!korisnik || !korisnik.token) {
        return { uspeh: false, poruka: 'Korisnik nije prijavljen.' };
      }

      // 1. Pripremi nesinhronizovane unose
      const svi = await StorageService.getSviPodsetnici();
      const nesinhronizovani = svi.filter(p => !p.is_synced);

      // Podrška i za Node.js backend (/sync) i za cPanel PHP backend (api.php?action=sync)
      const isPhpBackend = apiUrl.includes('.php');
      const url = isPhpBackend
        ? `${apiUrl}?action=sync&korisnik_id=${korisnik.id}`
        : `${apiUrl}/sync`;

      // 2. Pošalji na server
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${korisnik.token}`
        },
        body: JSON.stringify({
          korisnik_id: korisnik.id,
          lokalni_unosi: nesinhronizovani
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        return { uspeh: false, poruka: errData.message || errData.poruka || 'Greška u komunikaciji sa serverom.' };
      }

      const data = await response.json();

      // 3. Označi poslate kao sinhronizovane
      if (data.snimljeni_uuid && Array.isArray(data.snimljeni_uuid)) {
        for (const item of data.snimljeni_uuid) {
          await StorageService.azurirajPodsetnik(item.uuid_lokalni, {
            is_synced: true,
            server_id: item.server_id
          });
        }
      }

      // 4. Ažuriraj lokalnu licencu i resetuj 72h tajmer
      if (data.licenca) {
        const novaLicenca: LicencaCache = {
          token_active: data.licenca.token_active,
          token_expires_at: data.licenca.token_expires_at,
          besplatni_unosi_iskorisceno: data.licenca.besplatni_unosi_iskorisceno,
          poslednja_sinhronizacija: data.licenca.server_vreme || new Date().toISOString()
        };
        await StorageService.sacuvajLicencu(novaLicenca);
      }

      return {
        uspeh: true,
        poruka: `Sinhronizacija uspešna. Preneto ${nesinhronizovani.length} unosa.`
      };
    } catch (err: any) {
      return {
        uspeh: false,
        poruka: 'Nema internet konekcije. Aplikacija nastavlja lokalni rad (do 72h).',
        greska: err.message
      };
    }
  }
};
