# WorkLog

Application web personnelle (PWA pour iPhone) pour suivre ses exercices et ses charges à la salle de sport. Les données restent sur le téléphone.

## Organisation du dépôt

| Emplacement | Contenu |
|---|---|
| `index.html` | page de l'application |
| `sw.js` | fonctionnement hors connexion (doit rester à la racine) |
| `manifest.webmanifest` | icône et nom sur l'écran d'accueil |
| `js/` | code : `app.js`, `mannequin.js`, `exercices-3d.js` |
| `css/` | styles : `style.css` |
| `data/` | liste des exercices (`data-v3.json`) et schéma du corps (`bodymap.json`) |
| `models/` | mannequin 3D (`mannequin.bin`, `mannequin-peau.jpg`) |
| `icons/` | icônes de l'application |
| `.github/workflows/deploy.yml` | déballage du zip et publication du site |
| `CHANGELOG.md` | historique des versions |
| `CREDITS.txt` | crédits des données, images et modèles |

## Mettre à jour

1. **Add file → Upload files**, déposer le zip de la nouvelle version (par exemple `worklog-0.6.2.2.zip`) à la racine, puis **Commit changes**.
2. GitHub déballe le zip, range les fichiers dans leurs dossiers, retire ceux qui ne servent plus, supprime le zip et publie le site. Le suivi est dans l'onglet **Actions**.
3. Sur l'iPhone, fermer puis rouvrir l'app. La version s'affiche en bas du menu.
