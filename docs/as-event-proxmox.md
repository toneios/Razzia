# AS Event : joueurs, projection et régie

Cette branche part de Razzia **3.1.0**. Elle ajoute un écran public indépendant et une révélation automatique des réponses pendant dix secondes.

## Utilisation

- **Joueurs** : ouvrir `/` et saisir le code, comme avant.
- **Régie** : ouvrir `/manager`, choisir le quiz et créer la partie. Le bouton **Ouvrir la projection** ouvre `/projection` dans un nouvel onglet. Cette adresse courte peut aussi être ouverte sur un autre ordinateur : saisir le mot de passe animateur et le PIN de la partie.
- **Projection** : déplacer cet onglet sur le projecteur, cliquer sur **Activer la projection et le son**. Ce clic demande le plein écran et permet au navigateur d'activer le son. `Échap` quitte le plein écran ; `F11` permet de le remettre sur Windows. Les restrictions de lecture automatique du navigateur peuvent nécessiter une interaction supplémentaire pour les médias.
- Les commandes de jeu et la suppression des joueurs restent sur la régie. Son coupé par défaut sur la régie pour éviter un doublon ; la case **Son sur la régie** permet de l'activer si nécessaire. Le comportement sonore des téléphones reste celui de Razzia.
- Après le chrono (ou dès que tous ont répondu), les bonnes réponses sont révélées automatiquement pendant **10 secondes**, avec un compte à rebours. Le classement (ou le podium final) apparaît ensuite automatiquement. Le classement reste affiché jusqu’au clic de la régie sur **Suivant** : la question suivante ne démarre jamais seule.
- La projection ne compte pas comme un joueur. Elle peut être fermée, rouverte ou reconnectée sans remplacer la régie. La projection exige le mot de passe animateur et le PIN. Le serveur vérifie aussi les liens directs : le PIN ou l’identifiant de partie seuls ne donnent aucun accès. Un jeton limité à cette partie est conservé dans la session de l’onglet pour les actualisations/reconnexions ; le mot de passe n’est pas conservé par l’application. Ce jeton ne donne aucun droit de gestion et cesse de fonctionner quand la partie est supprimée ou le serveur redémarre.
- Les parties restent en mémoire : une mise à jour/redémarrage interrompt la partie. Le serveur conserve les règles de reconnexion/expiration de Razzia ; une déconnexion de la régie avant le début ferme la salle.

## Apparence depuis la régie

Dans `/manager`, ouvrir **Apparence** pour changer les couleurs principales et les quatre couleurs de réponses, importer un fond (PNG/JPEG/WebP, 4 Mo maximum) et une musique (MP3/WAV, 15 Mo maximum), régler le volume ou couper la musique. Cliquer **Enregistrer** applique les réglages aux écrans connectés. Le logo et les autres champs personnalisés existants sont conservés.

La musique d’ambiance joue uniquement pendant l’affichage de la question et le temps de réponse. Elle s’arrête dès la révélation et reste coupée au classement, au podium et dans la salle d’attente. Elle reste coupée sur les téléphones, respecte la case son de la régie et reste coupée pour toute question avec un média (audio, photo ou vidéo). Activer le son sur la projection par son bouton habituel.

Les fichiers et réglages sont enregistrés dans `config/branding` sur le PC (ou le dossier `CONFIG_PATH/branding` du serveur), hors du code Git. Les mises à jour du dépôt les conservent. Les boutons de restauration permettent de retrouver le fond et la musique AS Event par défaut.

## Identité AS Event

Le thème par défaut utilise le logo AS Event fourni, une palette noir/beige doré et un fond de scène en CSS. Le logo apparaît sur l'accueil, la régie, les téléphones et la projection. Les réponses conservent quatre couleurs distinctes, avec des teintes plus sombres pour le contraste du texte blanc. Aucun téléchargement de police ou d'image externe n'est nécessaire pour ce thème.

Ce thème fait partie du code : `update` suffit pour l'installer. Un éventuel `/opt/razzia-config/branding/theme.json` reste prioritaire pour les champs renseignés (logo, nom, couleurs, fond) ; il n'est pas écrasé. Voir [branding.md](branding.md) pour personnaliser une soirée particulière.

## Préparer le conteneur Proxmox

Exécuter dans **le conteneur Razzia**, pas dans l'hôte PVE. L'installation Community Scripts existante et son reverse proxy nginx sont conservés. Le chemin exact de la racine web doit être relevé sur cette installation :

```bash
nginx -T 2>/dev/null | grep -E 'listen |root |alias |proxy_pass'
systemctl cat razzia
node --version
pnpm --version
```

Le service connu utilise `/opt/razzia/packages/socket/dist/index.cjs` et `/opt/razzia-config`. Identifier la directive `root` du serveur nginx Razzia et la mettre dans la configuration ci-dessous. **Ne pas deviner ce chemin.** Le script vérifiera qu'il correspond bien à nginx.

Créer `/etc/razzia-as-event.conf` (propriétaire root, permissions 600) :

```bash
RAZZIA_REPOSITORY=https://github.com/toneios/Razzia.git
RAZZIA_BRANCH=as-event/three-interfaces
RAZZIA_WEB_ROOT=/CHEMIN/EXACT/DE/LA/DIRECTIVE/ROOT
```

Après fusion de la PR, on peut choisir `RAZZIA_BRANCH=main`. Pour tester cette branche avant fusion, conserver sa valeur ci-dessus.

Récupérer le dépôt et installer la commande :

```bash
git clone --branch as-event/three-interfaces https://github.com/toneios/Razzia.git /opt/razzia-as-event-source
install -m 0755 /opt/razzia-as-event-source/scripts/razzia-update.sh /usr/local/sbin/razzia-update
chmod 600 /etc/razzia-as-event.conf
razzia-update
```

Cette première commande construit et vérifie la version **sans l'activer**. Node.js 24+, pnpm compatible avec le lockfile et l'accès sortant GitHub/npm sont nécessaires. Le build consomme de la RAM et du disque ; un échec de compilation laisse le service actuel en place.

Pour déployer, **en dehors d'une partie** :

```bash
razzia-update --activate
```

La commande récupère la branche configurée dans une nouvelle release, installe et compile avant de basculer le service. Elle ajoute un drop-in systemd et relie la racine web nginx aux fichiers compilés. Si le démarrage/contrôle WebSocket local échoue, elle tente de restaurer la version précédente. `/opt/razzia-config` (quiz, résultats, mot de passe, branding) n'est ni copié dans Git ni remplacé. La configuration nginx et ses alias branding restent en place.

Après activation, actualiser les pages joueurs, régie et projection pour charger la même version. Vérifier une partie courte sur les trois écrans. La vérification locale du script ne teste pas le reverse proxy externe, les navigateurs ni le matériel audio.

Les releases précédentes restent sous `/opt/razzia-as-event/releases` ; supprimer uniquement les anciennes releases inutilisées après validation pour récupérer de la place. Le script installé dans `/usr/local/sbin` est indépendant : si son code évolue, réinstaller sa nouvelle version depuis le dépôt.

**Ne plus utiliser `update` de Community Scripts pour Razzia** : il suit le projet officiel et peut écraser ces changements. Intégrer les nouveautés officielles dans ce fork, résoudre les conflits, tester, puis déployer.

## Vérification du développement

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm exec tsc --noEmit -p packages/socket/tsconfig.json
pnpm exec tsc --noEmit -p packages/web/tsconfig.app.json
node --test tests/projection.test.mjs tests/branding.test.mjs tests/media-playback.test.mjs tests/hidden-scores.test.mjs
bash -n scripts/razzia-update.sh
```

Le test démarre un serveur temporaire sur un port isolé avec des quiz et identités synthétiques, sans accéder à la configuration de production.

## Tester sur Windows avec un autre écran

Après mise à jour du code, lancer `pnpm dev` depuis `D:\Dev\Razzia`. Sur le Mac, ouvrir `http://IP-DU-PC:3000/projection` (même réseau). Saisir le mot de passe utilisé dans la régie Windows et le PIN de la partie, puis activer la projection et le son. Le téléphone rejoint `/` avec le PIN seulement. Ne pas utiliser `localhost` sur le Mac : cela désignerait le Mac lui-même.

La protection bloque les accès sans authentification, mais HTTP ne chiffre pas le mot de passe sur le réseau ; utiliser HTTPS pour un accès via un réseau non fiable ou Internet.

## Blind test avec le dossier music sur Windows

1. Déposer les MP3 dans `D:\Dev\Razzia\music` (sans sous-dossiers).
2. Dans la régie, créer/modifier un quiz et ouvrir une question.
3. Sous **Blind test · dossier music**, cliquer **Actualiser la liste**, choisir le morceau, puis **Utiliser pour cette question**.
4. Régler **Début de l’extrait** en secondes, le temps de réponse, les choix et la bonne réponse. Enregistrer le quiz.
5. Activer le son de la projection : l’extrait démarre dès l’énoncé, continue pendant les réponses, sans musique d’ambiance superposée, puis coupé à la révélation. Les téléphones ne jouent pas l’extrait.

La liste est réservée au manager et ignore les sous-dossiers et liens symboliques. Chaque morceau importé (MP3, 100 Mo max) est copié avec un nom neutre dans `config/branding` : renommer/supprimer le MP3 source ne casse pas le quiz. Un import direct MP3/WAV de 15 Mo maximum est aussi possible depuis l’éditeur. Les MP3 du dossier `music` sont exclus de Git. Pour un autre chemin de bibliothèque, définir `MUSIC_PATH` dans l’environnement du serveur ; lors d’un futur déploiement Proxmox, transférer aussi les fichiers `branding` et définir un chemin persistant pour cette bibliothèque.

## Images et vidéos locales

Les dossiers `image` (PNG/JPG/WebP, 20 Mo max) et `video` (MP4/WebM, 200 Mo max) sont à la racine, à côté de `music`. Dans l’éditeur de question, choisir le type sous **Médias · dossiers music / image / video**, actualiser, sélectionner et cliquer **Utiliser pour cette question**, puis enregistrer le quiz. Les fichiers sont copiés dans `config/branding` et restent accessibles aux autres appareils. Les sources locales sont exclues de Git. Les chemins peuvent être remplacés par `IMAGE_PATH` et `VIDEO_PATH` dans l’environnement du serveur.

La musique d’ambiance est désactivée pour toute la question dès qu’elle contient un média, y compris pendant l’affichage de l’énoncé avant les réponses. Les extraits audio/vidéo démarrent dès l’énoncé, continuent sans redémarrer à l’apparition des choix et s’arrêtent à la révélation. Le volume de chaque extrait se règle de 0 à 100 % dans l’éditeur et est conservé dans le quiz. Les photos s’affichent dès l’énoncé.

## Éditeur et lecture des extraits

L’éditeur de quiz utilise un thème sombre. Le panneau média affiche une seule source à la fois : **Mes dossiers**, **Importer un MP3** ou **Lien direct**. Une fois le média choisi, son aperçu, le début et le volume restent accessibles ; **Changer le média** déplie le sélecteur. Les points et pénalités sont regroupés sous **Points et règles avancées**.

La lecture est relancée explicitement lors du remontage du lecteur, notamment en mode développement React. Si le navigateur bloque le démarrage, le bouton **Lire l’extrait** permet de l’autoriser. Un fichier absent ou non pris en charge affiche une erreur au lieu de rester silencieux. Sur la projection, cliquer d’abord **Activer la projection et le son** ; la régie reste muette tant que sa case son est désactivée.

## Préparer la question suivante depuis la régie

Pendant la révélation des réponses et le classement, la régie affiche une carte **À suivre** : prochain énoncé, choix, bonnes réponses, type de média et temps de réponse. Elle sert de pense-bête pour l’animation, sans démarrer le média. La question suivante reste déclenchée par **Suivant**.

L’aperçu est envoyé par un événement privé au seul socket de la régie, restauré après sa reconnexion et effacé au démarrage de la prochaine question. Les joueurs et la projection ne reçoivent ni cet événement ni le contenu de la question en avance. Aucune carte n’apparaît après la dernière question.

## Garder les scores secrets et remettre les médailles

Dans l’éditeur du quiz, cocher **Masquer les scores jusqu’à la fin**, puis enregistrer. Le réglage est propre à chaque quiz et suit son import/export JSON (`hideScoresUntilEnd`). Les quiz existants gardent le déroulement habituel tant que cette case n’est pas cochée.

Avec cette option, les bonnes réponses sont toujours révélées pendant dix secondes, puis une pause remplace le classement. Les téléphones ne montrent ni points ni rang. La régie conserve son aperçu privé de la question suivante et déclenche la suite avec **Suivant**. Les scores restent calculés côté serveur, sans être envoyés aux joueurs ou à la projection, y compris lors d’une reconnexion.

Après la dernière révélation, l’écran attend la remise des prix. Le bouton de régie **Révéler le podium** affiche le classement final et les médailles or/argent/bronze ; les téléphones reçoivent alors leur rang et leurs points. Les trois premiers reçoivent aussi une médaille sur leur écran. La révélation ne peut être déclenchée que par la régie et ne produit qu’un seul rapport de résultat.

## Version et mises à jour dans la régie

Le manager et la barre de régie affichent le commit du serveur en cours : blanc avec « À jour » si ce commit correspond à la tête de `toneios/Razzia`, branche `as-event/three-interfaces`, orange avec « Mise à jour disponible » sinon. La vérification est réservée aux managers authentifiés et passe par le serveur, sans jeton GitHub dans le navigateur.

Le serveur conserve le résultat cinq minutes et partage la requête entre les onglets. Les écrans consultent ce résultat toutes les minutes ; un changement GitHub apparaît habituellement sous cinq minutes. En cas d’erreur réseau, de quota GitHub ou de version locale inconnue, le badge devient gris et indique « Vérification indisponible ». Une nouvelle tentative est possible après une minute.

Le commit est intégré au serveur lors de sa compilation. Un simple `git pull` sans reconstruction et redémarrage ne change donc pas la version annoncée. L’indicateur ne déclenche aucune installation : utiliser `razzia-update --activate` dans la console du conteneur entre deux parties, puis actualiser les navigateurs.

Vérification : `node --test tests/version.test.mjs tests/version-integration.test.mjs tests/version-badge.test.mjs` après `pnpm build` (Node.js 24+).
