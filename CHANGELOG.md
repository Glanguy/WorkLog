# WorkLog : historique des versions

## 0.8.4
**Corrections**
- Double appui sur « Valider la série » (accueil, page de la séance, fiche exercice) : il pouvait encore enregistrer deux séries, car le 2e appui arrivait juste après l'enregistrement. Plus rien n'est enregistré dans la demi-seconde qui suit.
- « Noter plusieurs séries » : un double appui sur « Valider » n'enregistre plus les séries deux fois.

## 0.8.3
**Corrections**
- Plusieurs séances le même jour : le titre de l’accueil et de la page « Aujourd’hui » est celui de la séance du haut, les autres suivent (« puis … »). Avant, après un remplacement, la même séance pouvait apparaître deux fois et la première disparaître du titre.
- Un double appui sur « Valider la série » (page de la séance, accueil, fiche exercice) n’enregistre plus deux séries : le bouton reste inactif pendant l’enregistrement.
- Remplacer une séance recopiée depuis le calendrier qui était en haut : la nouvelle séance prend sa place, en haut.

## 0.8.2
**Plusieurs séances le même jour**
- La page « Aujourd’hui » affiche en haut une carte par séance prévue (nom, muscles, avancement). La séance choisie en premier reste en haut, celles ajoutées ensuite passent en dessous.
- La liste des exercices est rangée par séance, dans le même ordre. L’exercice « en cours » suit cet ordre : toute la première séance, puis la suivante.
- Remplacer une séance : la nouvelle prend sa place (en haut si c’était la première).
- Une séance recopiée depuis le calendrier (« Refaire cette séance aujourd’hui ») a aussi sa carte et garde son nom ; si elle a été choisie en premier, elle reste en haut. Le bouton « Modifier » est sur la séance qui donne son nom à la journée.
- Accueil : les autres séances du jour s’affichent sous le titre (« puis Étirements · Vélo »).

**La même carte de série pour tous les exercices**
- Étirements, gainage et cardio utilisent maintenant la carte « Série 1 sur 2 » de la musculation : la durée prévue est déjà remplie, « Valider la série », confirmation avec « Annuler », puis la proposition de passer à l’exercice suivant quand toutes les séries prévues sont faites.
- Étirements et gainage : une grande case « Durée » en secondes. Cardio : minutes et secondes en grand, distance, pente, niveau, tours ou calories en dessous.

**Valider une série programmée d’un appui**
- Sur la page de la séance, l’exercice en cours affiche « Valider la série » au lieu de « C’est parti » quand la série suivante est programmée (charge et répétitions, ou durée). Pour changer les valeurs, toucher l’exercice ouvre sa fiche.
- Même chose sur la carte « À faire maintenant » de l’accueil pour les étirements et le cardio.

## 0.8.1
**Plus simple, façon iPhone**
- Transitions comme sur iPhone : la nouvelle page glisse depuis la droite pendant que l'ancienne recule et s'assombrit ; au retour, l'inverse. Changer d'onglet : simple fondu.
- La barre du bas ne bouge plus pendant les transitions ; elle glisse hors de l'écran sur les pages sans onglet.
- Style « liquid glass » : boutons, pastilles, barre du bas et touches de calcul en verre dépoli translucide, avec reflet ; boutons citron et cartes violettes avec un léger relief.
- Toucher l'onglet où l'on est ramène à sa page de base (recherche, filtres et groupe effacés dans Exercices ; mois en cours dans Calendrier).
- Le « + » de la barre du bas ouvre la création d'une séance type.

**Fiche exercice**
- Plus de roues : poids et répétitions se tapent au clavier, dans deux grandes cases (le poids accepte un calcul, le résultat s'affiche dessous ; un calcul long rétrécit pour tenir dans la case).
- Plus de bouton « Cran », plus de « Recopier » dans la carte (le dernier poids et les dernières répétitions restent dans les cases après « Valider » ; le bouton recopier de « Dernière séance » reste).
- « Poids du corps » seulement sur les exercices qui s'y prêtent (pompes, tractions, dips, gainage, exercices sans matériel).
- La date et l'heure de la série sont toujours affichées (l'heure suit l'horloge) ; un appui permet de les changer.
- Muscle principal et un muscle secondaire ; « … » affiche les autres.
- La section « Animation et muscles » du bas est retirée (la vignette du haut s'agrandit d'un appui).
- La confirmation « Série n enregistrée · Annuler » s'affiche dans la carte, sous le bouton, au lieu d'un bandeau en haut qui cachait des boutons.
- Séance avec des séries prévues : « Série 2 sur 3 », puis, une fois toutes faites, une fenêtre propose de passer à l'exercice suivant de la séance (ou de voir la séance terminée). La saisie est alors fermée ; « Une série en plus » permet quand même d'en ajouter une.

**Accueil**
- « À faire maintenant » : un appui sur le poids ou les répétitions permet de les taper au clavier ; les − / + restent à 2,5 kg. La confirmation s'affiche dans la carte.

**Bibliothèque**
- Bouton « Filtres » à côté de la recherche : type (musculation, étirements), matériel (poids du corps, haltères, barre, barre EZ, kettlebell, machine, poulie, élastique, Smith machine, médecine-ball/swiss ball, TRX/anneaux/sangles, autre), groupe musculaire, favoris, déjà faits, unilatéral (un bras ou une jambe à la fois, exercices alternés compris), à la maison (poids du corps, élastiques, kettlebell). Seuls les filtres choisis restent affichés, en pastilles qu'on retire d'un appui. Les filtres marchent aussi sans texte de recherche.
- Le matériel et le côté unilatéral sont déduits du nom de l'exercice (la base ne les donne pas) : quelques exercices peuvent être mal classés.
- Favoris : exporter et importer sont réunis dans le bouton « … » en haut à droite.

**Séances**
- Mes séances : seulement le groupe musculaire principal sur chaque séance.
- Séances d'étirements et de mobilité : durée estimée (temps prévus, 30 s par défaut, + 10 s pour changer de position).
- « Aujourd'hui » sur une séance de musculation alors qu'une autre séance est déjà prévue : choix entre remplacer la séance prévue (les exercices déjà commencés restent) ou l'ajouter à la suite. Les séances d'étirements et de mobilité s'ajoutent directement.

**Couleurs, menus, diagnostic**
- Les groupes musculaires retrouvent chacun leur couleur, ravivée pour le fond noir : cou gris bleuté, épaules bleu, pectoraux rose, dos menthe, bras orange, abdos or, jambes orchidée, cardio corail. On les voit sur les étiquettes, les cartes de séances, les tuiles de la bibliothèque, le muscle principal de la fiche exercice, la carte « Séance du jour » et en point sous les jours nommés du calendrier.
- Séances : exporter et importer sont réunis dans le bouton « … » en haut à droite, en face du titre.
- Réglages : la section Diagnostic est cachée. 7 appuis sur « WorkLog version… » la font apparaître ; c'est gardé dans l'export de l'historique complet.
- Noms d'exercices longs : ils passent à la ligne dans les boutons (« Exercice suivant », fenêtre de fin des séries prévues) au lieu de déborder de l'écran.
- « Aujourd'hui » avec plusieurs séances déjà prévues (par exemple Jambes + Étirements) : choix entre remplacer seulement la séance de musculation en gardant les étirements, remplacer tout ce qui est prévu, ou ajouter à la suite.

## 0.8.0
**Nouveau design « Néon »**
- Fond noir, violet électrique (#5B3BFF) et jaune citron (#E6FF2B). Le citron sert seulement à ce qu'il faut voir en premier : la séance du jour, les gros chiffres, les records et le bouton pour valider une série.
- Police Hubot Sans (licence OFL), fournie avec l'app : elle marche hors ligne. Les chiffres viennent de sa police sœur Mona Sans, avec un zéro sans barre, plus lisible pour les charges.
- Nouveau logo : une barre de musculation pliée en W, disques rangés comme sur une vraie barre (gros contre le centre). Nouvelles icônes pour l'écran d'accueil de l'iPhone.
- Les groupes musculaires n'ont plus chacun leur couleur : tout est en violet et citron.
- Thème noir uniquement (l'ancien thème clair est retiré).

**Navigation**
- Barre flottante en bas : Accueil, Exercices, le gros bouton « + », Séances, Calendrier. Le menu de l'accueil disparaît ; les Réglages sont sur la roue crantée de l'accueil, l'Historique dans le calendrier.
- Le « + » ouvre l'exercice à faire de la séance du jour (le premier sans série, ou avec des séries prévues restantes), sinon la bibliothèque.

**Accueil**
- Carte « Séance du jour » avec un anneau de progression et « Reprendre » (glisser vers la gauche la retire toujours de l'accueil). Sans séance prévue : « Mes séances » ou « Un exercice ».
- « À faire maintenant » : poids et répétitions avec − / +, puis « Valider », sans quitter l'accueil (ou « Reprendre » sur le dernier exercice fait).
- « Cette semaine » : une barre par jour (nombre de séries), aujourd'hui en citron.

**Fiche exercice**
- Vignette, nom et muscles en haut ; la grande animation et le schéma des muscles sont dans « Animation et muscles ».
- Carte « Série n » avec deux roues (poids, répétitions) qu'on fait défiler. Toucher le chiffre du milieu permet de le taper, avec la barre de calcul au-dessus du clavier (20+2,5+2,5 → 25, le résultat s'affiche pendant la saisie).
- Sous les roues : « Poids du corps » (la roue devient le lest, négatif = assistance), « Cran » de la roue réglable pour chaque exercice (0,5 à 10 kg, deviné au départ : haltères 2 kg, machines et poulies 5 kg, sinon 2,5 kg), et l'heure de la série (maintenant, ou choisie).
- Valeurs de départ : la série prévue dans la séance, sinon la dernière faite. « Recopier » reprend la dernière série ; le bouton à côté de chaque série de « Dernière séance » la recopie aussi dans les roues.
- « Noter plusieurs séries » ouvre l'ancienne saisie à plusieurs lignes (date de chaque série, dupliquer, retirer) dans une fenêtre du bas.
- Quitter avec une série réglée mais pas validée : WorkLog demande s'il faut la valider.
- Cardio et exercices tenus : saisie inchangée.

**Séance du jour**
- Page à part, en parcours : une ligne relie les exercices, ceux faits ont une coche citron, celui à faire est mis en avant en violet avec ses séries faites/prévues et « Continuer ». Nom, note, réordonner, glisser pour supprimer, ajouter un exercice, séances types : tout est conservé.

**Bibliothèque**
- « Choisis un muscle » : grandes tuiles (Favoris, chaque groupe, Étirements) avec le nombre d'exercices ; dans un groupe, ses sous-groupes en pastilles puis la liste. La recherche reste en haut.

**Calendrier**
- Nombre de semaines d'affilée avec au moins une séance, grille du mois (séance en violet, record de charge en citron, séance prévue entourée, aujourd'hui entouré de citron), chiffres du mois (séances, records, séries) et résumé du jour choisi avec « Ouvrir la séance ».

## 0.7.7
**Exercices corrigés**
- Développé décliné à la machine : nouvelle machine à leviers convergents (modèle 3D fourni), les leviers suivent les mains ; dossier incliné, poussée vers l'avant et le bas jusqu'aux bras tendus.
- Développé poitrine à la machine, développé poitrine assis à la poulie, développé pectoraux à la poulie : départ mains à hauteur de poitrine, coudes en arrière ; arrivée bras tendus devant la poitrine ; câbles qui ne touchent plus les avant-bras.
- Développés couchés aux haltères (prise normale et serrée) : bras tendus en haut du mouvement.
- Rowing assis unilatéral, tirage horizontal prise serrée alterné, curl incliné, curl marteau alterné : un bras après l'autre, chaque bras revient au repos avant que l'autre parte, rythme plus calme.
- Élévation deltoïdes alternée : bras tendus du début à la fin.
- Élévation frontale à la poulie : pieds plus écartés et poulie plus basse, le câble passe entre les jambes sans les traverser.
- Car drivers : disque de taille fixe tenu par le bord, les mains ne rentrent plus dedans.
- Élévation latérale à la landmine : la main tient le bout de la barre, le disque est du côté du pivot.
- Dips (normaux et lestés) : barre sous le talon de la main, coudes un peu plus ouverts, les avant-bras ne touchent plus les poignées.
- Écarté croisé debout : mains croisées sans que le câble touche l'avant-bras.
- Soulevé de terre jambes tendues à l'élastique : l'élastique part de l'avant du pied et passe devant les jambes.

## 0.7.6
**Exercices plus naturels**
- Curls biceps refaits (haltères debout et assis, barre EZ, marteau, concentration, pupitre, inclinés, curl puis développé) : le coude reste près du corps, seul l'avant-bras monte, la paume garde son orientation du début à la fin.
- Écartés à la poulie, vis-à-vis, élévations latérales, frontales et oiseau : bras tendus (coude juste déverrouillé) du début à la fin, la main tourne autour de l'épaule.
- Élévations à la poulie basse (une main, deux mains, câbles croisés) et élévation deltoïdes alternée refaites d'après leur image de référence et leur consigne.
- Mains et poignets : plus de main qui se retourne en cours de mouvement, poignets alignés avec l'avant-bras sur les presses, les tirages, les dips et les appuis.
- Câbles : plus aucun câble ne passe dans le corps (développé à la poulie, tirages, ceinture des dips lestés).
- Machines : plus de cuisse, de dos ou de tête qui rentre dans un siège, un dossier ou une barre (presses, rowings, banc incliné, tractions australiennes, oiseau tête en appui).
- Tirage horizontal assis : prise neutre, buste penché vers l'avant puis redressé, coudes le long du corps.
- Soulevé de terre roumain : genoux un peu plus fléchis en bas, haltères devant les tibias.
- Banc droit sans boudins pour les jambes ; banc à 55° pour les curls inclinés.

**Contrôle de forme**
- Chaque animation est comparée automatiquement à ses images de référence (posture du corps image par image) et à des règles par famille d'exercice : bras tendus sur les écartés et élévations, coude fixe et amplitude sur les curls, mains qui ne tournent pas, symétrie, poignets, câbles hors du corps, pieds à plat, cou.
- Ce contrôle tourne avant chaque version, en plus du contrôle des collisions.

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
