// Apps instalados e abertura de app via tizen.application. O que o device entrega a um app
// NOSSO (filtro, ícones, permissão de launch) é medido no device antes de ser assumido.

export interface InstalledApp {
  id: string;
  name: string;
  iconPath: string;
  show: boolean;
  categories: string[];
}

export function listApps(): Promise<InstalledApp[]> {
  const app = window.tizen?.application;
  if (!app) return Promise.reject(new Error('tizen.application indisponível'));
  return new Promise((resolve, reject) => {
    try {
      app.getAppsInfo(
        (list) =>
          resolve(
            list.map((a) => ({ id: a.id, name: a.name, iconPath: a.iconPath, show: a.show, categories: a.categories })),
          ),
        (e) => reject(new Error(`${e.name}: ${e.message}`)),
      );
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
}

export function launchApp(id: string): Promise<void> {
  const app = window.tizen?.application;
  if (!app) return Promise.reject(new Error('tizen.application indisponível'));
  return new Promise((resolve, reject) => {
    try {
      app.launch(id, () => resolve(), (e) => reject(new Error(`${e.name}: ${e.message}`)));
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
}
