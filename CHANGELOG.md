# WorkLog : historique des versions

## 0.7.5
**Mains**
- Le mannequin ferme maintenant les mains sur ce qu'il tient : poignées de poulie, haltères, barres, kettlebells, poignées des machines. Les doigts et le pouce se plient autour de l'objet.
- Mains à plat (appui au sol, sur un banc) et mains posées restent ouvertes ; entre deux positions, la fermeture se fait progressivement.

**Machines et matériel en vrais modèles 3D**
- Le matériel dessiné en formes simples est remplacé par des modèles 3D de machines réelles, allégés pour rester rapides sur iPhone : haltères, disques, kettlebell, swiss ball, bancs (plat, développé couché, réglable), Smith machine, vis-à-vis et colonne de poulie, tirage vertical, rowing assis à la poulie, rowing appui poitrine, presse pectoraux, presse épaules, leg extension, leg curl allongé, adducteurs, hack squat, presse à cuisses 45°, traction assistée, banc à lombaires 45°, barres de dips, cage.
- Les pièces mobiles suivent le mouvement : bras des presses et des rowings, levier du leg curl et du leg extension, chariot du hack squat et de la presse à cuisses (sur leurs rails), plateau des genoux de la traction assistée, bras des adducteurs avec les repose-pieds, dossier du banc réglable à l'inclinaison de l'exercice, barre de la Smith machine.
- Les positions du corps ont été recalées sur chaque machine (hauteur du siège, dossier, appuis des pieds, poignées).
- Le nom des auteurs et la licence des modèles utilisés s'affichent sous l'animation dans la page exercice ; la liste complète est dans `CREDITS.txt`.
- Pas encore de modèle pour la presse déclinée (e1300) : elle garde son matériel dessiné.

**Contrôle des animations**
- Le contrôle automatique vérifie maintenant aussi la surface des machines (pas seulement leur forme simplifiée) : aucune partie du corps ne traverse une machine.

**Moteur 3D**
- Nouveau dossier `models/mat/` : un fichier compact par machine, chargé seulement quand une animation qui l'utilise s'affiche, puis gardé hors ligne.

## 0.7.4
**Mannequin 3D pour les 73 exercices favoris**
- Chaque exercice des favoris (épaules, pectoraux, dos, bras, jambes) a maintenant son animation 3D sur le mannequin, à la place du gif ou des photos : vignette dans les listes, grande animation dans la page exercice et agrandissement.
- L'exercice reste celui de la bibliothèque : même nom, mêmes muscles, même historique, même saisie poids × répétitions. Seul le visuel change.
- Les muscles principaux et secondaires de la bibliothèque sont colorés sur le mannequin ; sur les exercices à un bras ou à une jambe, seul le côté qui travaille est coloré.
- Le matériel est dessiné : barres et disques, haltères, kettlebells, poulies et câbles, corde, élastiques, bancs plats, inclinés et à dossier, machines (presses, leg curl, leg extension, adducteurs, tirage, rowing, développé), swiss ball, banc à lombaires, barres de dips, cadre de traction assistée, landmine.
- Mouvements repris des images de référence de chaque exercice (positions de départ et d'arrivée, prise, appui, inclinaison du buste).
- Contrôle automatique de chaque animation, image par image : aucun membre dans un autre, aucun membre dans le matériel, rien sous le sol, pas de bras ou d'avant-bras vrillé, pas de saut.

**Piriforme**
- Les mains tirent maintenant les jambes vers soi : main gauche derrière la cuisse gauche, main droite derrière la cuisse droite (côté ischio-jambiers), et non plus posées sur le dessus des cuisses comme si elles les repoussaient.

**Moteur 3D**
- Nouveau fichier `js/exercices-3d-muscu.js` : les animations des exercices de musculation, rattachées aux exercices de la bibliothèque.
- Matériel qui suit le mouvement (calculé à chaque image depuis les mains et les os du mannequin), corps qui peut rester en l'air (suspendu, assis sur une machine), nouvelle forme « sphère » pour les ballons et kettlebells.

## 0.7.3
**Diagnostic**
- Deux réglages séparés dans Réglages › Diagnostic : « Afficher le compteur » (le compteur en bas de l'écran) et « Rapports de plantage » (le relevé toutes les 2 secondes, gardé sur le téléphone, et la fenêtre « WorkLog s'est arrêté » avec « Copier le rapport » à la réouverture après un blocage).
- On peut activer l'un sans l'autre. Rapports désactivés : rien n'est noté et le relevé déjà gardé est effacé. Tant que les rapports n'ont jamais été réglés, ils suivent le compteur (comme en 0.7.1 et 0.7.2).

**Fenêtres qui s'ouvrent du bas (choix du graphique, menus « … », listes à cocher…)**
- Glisser la fenêtre vers le bas la ferme : elle suit le doigt, se ferme au-delà d'un petit seuil ou d'un geste rapide, et revient en place sinon. Si sa liste a été défilée, il faut d'abord remonter en haut de la liste.
- La page derrière ne défile plus tant qu'une fenêtre est ouverte.

## 0.7.2
**Écran blanc dans la bibliothèque (suite)**
- Ce que le diagnostic de la 0.7.1 a montré : au moment du blocage, l'app tournait toujours (relevés réguliers, aucun blocage) avec seulement 241 lignes, 15 images et 13 gifs dans la page. Ce n'était donc ni le code de l'app ni le nombre de lignes, mais Safari qui arrêtait de dessiner la page.
- Cause la plus probable : Safari garde dans sa mémoire graphique chaque gif animé et chaque grande photo affichés par une balise image, même une fois retirés de la page. Un gif d'exercice prend environ 1,5 Mo une fois décodé, une photo free-exercise-db (750 × 500) aussi, et il y en a deux par exercice. Après quelques centaines d'exercices parcourus, cette mémoire déborde.
- Correction : les vignettes des listes (bibliothèque, ajout d'exercices à une séance, calendrier) ne passent plus par des balises image. L'app décode elle-même chaque gif image par image et le dessine dans un petit canvas ; les photos sont réduites à la taille de la vignette (216 × 144) et la grande photo décodée est libérée aussitôt. Dès qu'une vignette sort de l'écran, son canvas est vidé et ses données oubliées. Seules les vignettes à l'écran sont animées.
- Nouveau fichier `js/gifreader.js` : le décodeur de gif d'omggif (licence MIT), ajouté aux crédits.
- Diagnostic : le compteur affiche maintenant le nombre de vignettes animées ; le rapport ajoute la mémoire occupée par les canvas.
- Le grand gif de la page exercice et l'agrandissement restent des images normales (un seul à la fois).

## 0.7.1
**Plantage de la bibliothèque**
- Cause la plus probable : en ouvrant plusieurs catégories sans les refermer (Épaules, Pectoraux, Dos, Biceps…), la page gardait des centaines de lignes d'exercices et lançait un chargement d'image pour chaque vignette croisée en défilant ; la mise en cache des images faisait en plus un tri complet à chaque image. Safari finissait par arrêter de dessiner la page (zones blanches, plus rien de cliquable).
- Une seule catégorie ouverte à la fois, à chaque niveau, dans la bibliothèque comme dans l'ajout d'exercices à une séance. La catégorie qu'on ouvre reste à sa place à l'écran, même si celle qu'on referme au-dessus contenait des centaines d'exercices.
- Les lignes hors de l'écran ne sont plus dessinées par Safari.
- Une vignette ne se charge que si elle reste à l'écran un court instant : un défilement rapide ne lance plus des centaines de chargements. Les exercices à l'écran restent animés, ceux qui en sortent sont retirés de la mémoire.
- Mise en cache des images allégée : l'image s'affiche sans attendre l'écriture dans le cache, le tri des plus anciennes se fait toutes les 60 images au lieu de chaque image, et le cache garde jusqu'à 1 500 images.

**Diagnostic (Réglages › Diagnostic)**
- Option à activer ou désactiver, désactivée par défaut. Activée : un compteur discret en bas de l'écran (lignes, images, gifs, catégories ouvertes, éléments de la page) et un relevé toutes les 2 secondes.
- Si l'app se fige ou s'arrête sans être fermée normalement, le relevé de juste avant s'affiche à la réouverture, avec « Copier le rapport ».

**Graphiques**
- Une seule ligne fine au-dessus du graphique : le nom du graphique affiché (le toucher ouvre la liste des graphiques, chacun avec une phrase qui dit ce qu'il mesure) et la période (2 sem., 1 m, 3 m, 6 m).
- 6 graphiques de musculation, dans cet ordre : Force estimée (par défaut), Charge max, Volume, Endurance relative, Répétitions à X %, Indice de fatigue.
- Endurance relative : répétitions faites à une charge légère ou moyenne ÷ répétitions prévues par ta force (formule d'Epley à l'envers, référence = ta meilleure force estimée des 3 derniers mois sur des séries de 1 à 10 répétitions). 100 % = autant que prévu ; au-dessus, ton muscle tient mieux. Seules les séries à 85 % de la référence ou moins comptent.
- Répétitions à X % : répétitions faites à 60, 70 ou 80 % de ta force estimée (à 5 points près), choix sous le graphique ; c'est le test d'endurance classique.
- Indice de fatigue : (répétitions de la 1re série − répétitions de la dernière) ÷ répétitions de la 1re série, sur les séries faites à la même charge le même jour. Plus c'est bas, mieux tu tiens.
- L'explication du calcul n'apparaît plus d'office : bouton « En savoir plus » sous la meilleure série, avec un exemple chiffré tiré de tes séries, pour chaque graphique.

**Page exercice**
- Sections repliables : « Dernière séance » (fermée par défaut, avec un résumé dans son titre), « Progression » et « Nouvelle série » (ouvertes). La partie visuelle (schéma et animation) reste toujours affichée.
- « Dernière séance » montre les 2 derniers jours où l'exercice a été fait, et un bouton « Voir tout l'historique ».
- Nouvelle page « Historique » par-dessus l'exercice : toutes les séries de cet exercice, jour par jour ; toucher une série pour la modifier ou la supprimer.
- Recopier une série (bouton à côté d'une série) : plus de message, la ligne remplie clignote brièvement.

**Autres**
- Messages plus fins, affichés en haut de l'écran : ils ne cachent plus « Valider ».
- Barre au-dessus du clavier : verre translucide et touches + − × ÷ = arrondies et espacées ; parenthèses retirées.
- L'app est faite pour le portrait : blocage dans ses réglages d'installation, et écran « Tourne ton téléphone » si le téléphone est en paysage.

## 0.7.0
**Graphiques**
- Un seul point par jour (avant : un point par série, d'où les traits verticaux quand on fait plusieurs séries le même jour).
- Trois onglets pour la musculation : « Force estimée » (par défaut), « Charge max » et « Volume ».
- Force estimée : la charge que tu pourrais soulever une fois (1RM), calculée pour chaque série avec la formule d'Epley, poids × (1 + répétitions ÷ 30) ; le point du jour est ta meilleure série. Une explication du calcul s'affiche sous le graphique, avec l'exemple de la série retenue.
- Charge max : la charge la plus lourde du jour, avec le nombre de répétitions faites à cette charge au-dessus du point.
- Volume : le total du jour (poids × répétitions de toutes les séries), c'est-à-dire l'ancien graphique.
- Cardio et étirements aussi par jour : durée totale, meilleure vitesse, plus longue tenue, niveau le plus haut, tours du jour.
- Graphique plus lisible : points plus gros, zone colorée sous la courbe, date complète du point sélectionné.

**Poids du corps**
- Nouveau réglage « Poids du corps » (menu › Réglages).
- Case « PDC » sur chaque série (« Poids du corps » dans la fenêtre de modification et dans les séances types). Cochée, le champ du poids devient le lest, avec un bouton + / − devant : + pour ajouter du lest, − pour retirer du poids (exercice assisté). Taper « - » ou « + » au début du champ règle aussi le bouton. Le total soulevé s'affiche à côté de la case.
- La série enregistre le poids total (poids du corps + lest) : graphiques et totaux restent justes même si ton poids change ensuite. Affichage : « PDC + 10 kg × 8 », « PDC − 20 kg × 8 ».
- Une nouvelle série reprend le mode PDC de la dernière série de l'exercice. Les séries prévues des séances types peuvent aussi être au poids du corps.

**Séries**
- « Dernières séances » : un bouton « dupliquer » à côté de chaque série la recopie dans « Nouvelle série » (toucher la série la modifie toujours).
- Les boutons dupliquer et retirer d'une série sont sur la même ligne que les champs, calés à droite (saisie, séances types).
- Le champ « Date et heure » ne dépasse plus de la fenêtre « Modifier la série » sur iPhone.

**Programmer des séances**
- « Programmer » une séance type (menu « … » d'une séance, ou bouton sur la page de la séance) : à une date précise, ou en répétition chaque semaine ou toutes les 2, 3 ou 4 semaines, les jours choisis, avec une date de fin facultative.
- Dans le calendrier, « Prévoir une séance type » sur aujourd'hui ou un jour à venir. On peut maintenant aller dans les mois suivants : les jours programmés y sont entourés.
- Une séance répétée est ajoutée au jour même (ou quand tu ouvres ce jour à l'avance). La page de la séance type liste ses programmations, avec une croix pour en arrêter une.

**Supprimer une séance**
- Dans le calendrier, « Retirer le nom de cette séance » devient « Supprimer la séance » : le nom et les exercices prévus pas encore faits disparaissent, les séries déjà faites restent, et tu reviens à la page précédente (avec « Annuler »).
- Supprimer une séance type retire aussi du calendrier ses exercices prévus pas encore faits (aujourd'hui compris) et sa programmation. Les séries déjà faites restent.

**Bibliothèque et recherche**
- Favoris et Mes séances : tous les dossiers sont fermés à l'ouverture, comme dans la bibliothèque.
- Étoile « favori » sur chaque exercice quand on ajoute des exercices à une séance.
- Recherche : chaque mot est cherché séparément, en français et en anglais, avec une tolérance aux fautes de frappe (« hip trust » trouve « Hip thrust à la barre »). Les résultats qui contiennent tous les mots passent en premier.
- Pendant une recherche : filtres par type (Tout, Favoris, Musculation, Étirements) et par groupe musculaire, avec le nombre de résultats.
- Correction du plantage après avoir parcouru beaucoup d'exercices : les vignettes (gifs, photos, mannequins 3D) ne sont chargées qu'à l'écran et retirées de la mémoire dès qu'elles en sortent ; un groupe refermé libère son contenu.

**Export et import**
- L'export ne crée plus de fichier texte « WorkLog » en plus de la sauvegarde.
- Favoris : « Exporter les favoris » et « Importer » dans l'onglet Favoris.
- Mes séances : « Exporter des séances » (toutes, ou seulement celles cochées) et « Importer ».
- Un import ajoute ce qui manque, sans rien effacer ni créer de doublon (deux séries identiques faites la même minute restent bien deux séries).
- L'export complet (Historique) contient tout ce que tu as rempli : séries, favoris, séances, notes, séances types, dossiers, programmations et réglages (poids du corps, adresse du NAS ; jamais le mot de passe).

**Langue**
- Français ou anglais (menu › Réglages › Langue) : toute l'application, y compris les 1 861 noms d'exercices. Les noms français suivent les termes courants des salles (développé couché, rowing, tirage vertical, oiseau, soulevé de terre…). La recherche marche dans les deux langues.

**Synchronisation avec ton NAS**
- Nouvelle section dans Réglages : adresse de ton serveur PocketBase, e-mail, mot de passe. Synchronisation automatique à l'ouverture et quelques secondes après chaque modification, bouton « Synchroniser maintenant », « Remplacer par les données du NAS », « Se déconnecter ».
- L'app ne contacte que l'adresse saisie ; le jeton de connexion reste sur le téléphone, le mot de passe n'est pas enregistré. Si deux appareils ont changé en même temps, les données sont fusionnées.
- Guide d'installation pour Synology DS224+ (Container Manager + PocketBase, accès HTTPS par Tailscale ou proxy inversé) : `docs/synchronisation-nas.html`, et la collection à importer : `docs/pocketbase-worklog.json`.

**Strava**
- « Copier pour Strava » dans le détail d'un jour : un résumé texte (exercices et séries, séries identiques regroupées) à coller dans la description de l'activité enregistrée par ta montre.

**Fichiers**
- Nouveaux : `js/i18n.js` (textes anglais), `data/names-fr.json` (noms français des exercices), `docs/` (guide NAS et collection PocketBase).

## 0.6.2.3
- Ischio unilat assis : la jambe tendue ne se retourne plus (l'ischio reste derrière la cuisse). Par défaut, le genou suit maintenant la cuisse sans rotation de hanche, pour toutes les jambes.
- Piriforme : mains visibles (main gauche sur la cuisse gauche, main droite qui pousse le genou droit), plus de main qui se retourne entre deux positions. Angle de départ qui montre à la fois les mains et la zone étirée.
- Ischios allongé : les mains tiennent l'arrière de la cuisse sur la peau, sans y entrer.
- Les mains qui tiennent un membre sont posées exactement sur sa surface et le suivent pendant les transitions.
- Corrections relevées par les nouveaux contrôles : Piriforme avec torsion, Prière latérale, Cheville dynamique en fente, Pec élastique, Phoque, Hanche et adducteur unilat, Grand dorsal/triceps avec barre.

## 0.6.2.2
- Dépôt GitHub rangé en dossiers : `js/` (code), `css/` (styles), `data/` (exercices et schéma du corps), `models/` (mannequin 3D), `icons/` (icônes). À la racine : `index.html`, `sw.js`, `manifest.webmanifest`, `README.md`, `CHANGELOG.md`, `CREDITS.txt`.
- Mise à jour par simple dépôt du zip : GitHub le déballe, range les fichiers, retire ceux qui ne servent plus et publie le site.
- Ajout d'un `README.md` qui présente l'app et la façon de la mettre à jour.
- Aucun changement dans l'app elle-même.

## 0.6.2
- Mannequin 3D : le corps garde son volume aux articulations. Les fesses ne s'écrasent plus quand la hanche plie beaucoup (Ischio unilat assis, Piriforme…), et les épaules et les coudes se déforment mieux.
- Poignets naturels : la rotation de la main passe par l'avant-bras (et par l'épaule quand le bras est tendu) au lieu de vriller le poignet. Bras tendus et mains à plat dans « Piriforme avec torsion ».
- Les mains qui se déplacent ne tournent plus sur elles-mêmes pendant les transitions.
- Muscles ciblés plus visibles : couleurs plus marquées, zones du piriforme et du TFL agrandies, angle de vue de départ choisi pour montrer le muscle principal de chaque exercice.

## 0.6.1
- Le mannequin 3D des 26 exercices d'étirements et de mobilité est remplacé par un corps réaliste (modèle « Male base muscular anatomy », CC BY 4.0).
- Plus de sol ni d'ombre : on peut tourner autour du mannequin dans tous les sens, y compris par en dessous.
- Animations plus fluides (plus d'à-coups) et contrôle automatique pour que les membres ne passent plus les uns dans les autres.
- Nouveaux muscles colorés et nommés : psoas, piriforme, TFL, rhomboïdes, deltoïde postérieur, coiffe des rotateurs.
- « Grand dorsal/triceps avec barre » refait d'après la vidéo (départ à genoux, puis assis sur les talons, coudes sur la caisse).

## 0.6.0
- Nouveau : 26 exercices d'étirements et de mobilité « maison », en français, dans l'onglet Étirements de la bibliothèque.
- Chaque exercice est montré par un mannequin 3D animé en boucle, avec les muscles ciblés colorés sur le corps et le matériel (caisse, bâton, élastique, haltère). Sur la fiche, on fait tourner le mannequin au doigt.
- Ces exercices se notent à la durée uniquement (secondes par série), avec un graphique de durée. « Durée par côté » est rappelé pour les exercices d'un seul côté.
- Séances types : une durée prévue par série pour ces exercices.
- « Prière » et « Dos rond/dos creux » remplacent « Child's pose » et « Cat stretch » ; l'historique et les favoris suivent.

## 0.5.3
- Correction : glisser la carte « Séance du jour » vers la gauche sur l'accueil la retire bien, même si des séries sont déjà faites. Les séries restent dans le calendrier et l'historique.
- Relancer une séance « Aujourd'hui » fait réapparaître la carte.

## 0.5.2
- Les copies de page laissées par une animation interrompue sont effacées à chaque changement de page.
- Les pages ont un fond plein.
- Le numéro de version s'affiche en bas du menu.

## 0.5.1
- Nouveau : retirer la séance du jour en glissant sa carte sur l'accueil, ou avec le bouton « Retirer la séance prévue » dans le calendrier, avec « Annuler ».

## 0.5.0
- Calendrier : le détail du jour s'affiche sous le calendrier ; on change de jour sans changer de page.
- Création de séance : brouillon enregistré seulement avec « Valider ». Un message indique les informations manquantes, et une fenêtre propose d'enregistrer en quittant.
- Mes séances : bouton « Nouveau dossier ». Section « Sans dossier » repliable. Menu « … » sur chaque séance (Déplacer vers, Renommer, Dupliquer, Supprimer) et sur chaque dossier (Renommer, Supprimer sans effacer les séances). Glisser une séance vers un dossier.
- Groupes secondaires choisis dans une liste à cocher compacte.
- Vignettes animées seulement quand elles sont à l'écran. Toucher une vignette l'agrandit.
- Ajout d'exercices : toute la ligne sélectionne.
- Réorganisation au doigt plus fluide, sans sélection de texte, avec défilement automatique.
- Bandeau du haut qui réapparaît quand on remonte.
- Animations : la page arrive de la droite, la flèche la fait repartir à droite, la croix la fait descendre.
- Note plus petite, sur une ligne.

## 0.4.1
- Muscles du schéma et de la légende vérifiés image par image sur les 1 324 exercices ExerciseDB.

## 0.4.0
- Séances types rangées en dossiers, lancées « Aujourd'hui ».
- Refaire une ancienne séance avec les charges préremplies, ou l'enregistrer comme séance type.
- Ordre des exercices modifiable.
- Glisser vers la gauche pour supprimer un exercice ou une série. Toucher une série pour la modifier.
- « Annuler » après « Valider », qui ramène à la saisie.
- Barre de calcul + − × ÷ ( ) = au-dessus du clavier pour le poids.
- Fenêtre « Enregistrer ? » en quittant avec une série non validée.
- Dupliquer une ligne de série.
- Notes par exercice et par journée.
- Cardio : durée, distance, vitesse, niveau ou tours selon l'activité.
- Export d'une journée en fichier d'activité .tcx (Strava, Garmin).

## 0.3.1
- Recherche : bouton pour tout effacer, nom exact en premier, « pull up » = « pull-up » = « pullup ».

## 0.3.0
- Base fusionnée : ExerciseDB et free-exercise-db, sans doublons, 1 837 exercices, noms en anglais.
- Schéma du corps (face et dos) avec les muscles colorés, et gif agrandissable.
- Bibliothèque en onglets : Favoris, Musculation, Étirements.
- Bouton « Séances » sur l'accueil.

## 0.2.0
- Base d'exercices intégrée à l'app, avec des images nettes.
- Catégories de la tête aux pieds, avec sous-catégories.
- Graphique sur 2 semaines par défaut, puis 1, 3 et 6 mois.
- Retour en arrière qui garde la position.
- Nommer une séance. Nouvelle page « Séances ».

## 0.1.0
- Première version : bibliothèque d'exercices, saisie des séries, graphique, historique, calendrier, import et export.
