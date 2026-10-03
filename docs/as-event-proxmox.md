# AS Event : joueurs, projection et régie

Cette branche part de Razzia **3.1.0**. Elle ajoute un écran public indépendant et une révélation manuelle des réponses.

## Utilisation

- **Joueurs** : ouvrir `/` et saisir le code, comme avant.
- **Régie** : ouvrir `/manager`, choisir le quiz et créer la partie. Le bouton **Ouvrir la projection** ouvre `/projection/<identifiant-de-partie>` dans un nouvel onglet. Le lien peut aussi être ouvert sur un autre ordinateur.
- **Projection** : déplacer cet onglet sur le projecteur, cliquer sur **Activer la projection et le son**. Ce clic demande le plein écran et permet au navigateur d'activer le son. `Échap` quitte le plein écran ; `F11` permet de le remettre sur Windows. Les restrictions de lecture automatique du navigateur peuvent nécessiter une interaction supplémentaire pour les médias.
- Les commandes de jeu et la suppression des joueurs restent sur la régie. Son coupé par défaut sur la régie pour éviter un doublon ; la case **Son sur la régie** permet de l'activer si nécessaire. Le comportement sonore des téléphones reste celui de Razzia.
- Après le chrono (ou dès que tous ont répondu), les réponses sont verrouillées. Cliquer **Révéler les réponses**, puis **Suivant** pour le classement/podium, puis **Suivant** pour la question suivante.
- La projection ne compte pas comme un joueur. Elle peut être fermée, rouverte ou reconnectée sans remplacer la régie. Le lien est public à toute personne qui le possède : aucun mot de passe animateur n'y est transmis.
- Les parties restent en mémoire : une mise à jour/redémarrage interrompt la partie. Le serveur conserve les règles de reconnexion/expiration de Razzia ; une déconnexion de la régie avant le début ferme la salle.

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
node --test tests/projection.test.mjs
bash -n scripts/razzia-update.sh
```

Le test démarre un serveur temporaire sur un port isolé avec des quiz et identités synthétiques, sans accéder à la configuration de production.
