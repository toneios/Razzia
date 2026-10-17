# AS Event — Pack de quiz soirée

Sept quiz en français, **92 questions**, quatre choix et une bonne réponse par question. Tous les médias sont facultatifs sauf pour le blind test à compléter. Aucun lien externe ni extrait audio n’est intégré.

## Importer

Dans la régie : **Quizz → Importer** (icône flèche vers le haut), puis choisir un fichier JSON de ce dossier. Répéter pour les quiz souhaités. Les fichiers sont disponibles après `git pull --ff-only`, sous `D:\Dev\Razzia\examples\soirees`. Les originaux restent dans le dépôt ; les versions importées se modifient dans l’application.

| Fichier                                | Public / ambiance                    | Questions |
| -------------------------------------- | ------------------------------------ | --------- |
| `01-tous-ages.json`                    | Tous âges : le grand mélange         | 20        |
| `02-musique-intergenerationnelle.json` | Musique : toutes les générations     | 12        |
| `03-cinema-series.json`                | Cinéma et séries : cultes à partager | 12        |
| `04-annees-80-90.json`                 | Années 80–90 : génération souvenirs  | 12        |
| `05-annees-2000.json`                  | Années 2000 : tubes et nostalgie     | 12        |
| `06-geek-jeux-video.json`              | Culture geek et jeux vidéo           | 12        |
| `07-blind-test-fete.json`              | Blind test : les tubes de la fête    | 12        |

## Animation

Commencer par le quiz généraliste pour mélanger les générations, puis proposer un thème au choix du public. Les questions sont majoritairement faciles à intermédiaires. Le mode geek et les deux quiz par décennie conviennent à des groupes qui apprécient ces univers. Les temps proposés sont de 20 secondes (25 pour le blind test), avec 3 secondes d’énoncé. La révélation de dix secondes et le passage manuel à la question suivante sont gérés par le jeu. Pas de pénalité ; le barème reste celui de Razzia.

Pour une animation plus courte, retirer des questions dans une copie du quiz. Vérifier les réponses avant la soirée et adapter la difficulté au public.

## Blind test — feuille de préparation animateur

**Ce quiz doit recevoir ses douze extraits avant d’être joué.** Les questions et choix sont déjà prêts ; les titres ci-dessous servent uniquement à choisir tes fichiers. Utiliser la version interprétée par l’artiste indiqué, en évitant reprises et remixes qui changent l’interprète.

Déposer les MP3 dans `music`, puis modifier chaque question : **Mes dossiers → music → Actualiser la liste → Utiliser pour cette question**. Régler début d’extrait et volume, écouter l’aperçu, puis enregistrer. Les fichiers sont copiés avec un nom neutre dans le dossier de diffusion ; le nom de la source ne s’affiche pas dans l’énoncé.

| Question | Artiste attendu      | Morceau à préparer               |
| -------- | -------------------- | -------------------------------- |
| 01       | ABBA                 | Dancing Queen                    |
| 02       | Queen                | Don’t Stop Me Now                |
| 03       | Jean-Jacques Goldman | Quand la musique est bonne       |
| 04       | Images               | Les Démons de minuit             |
| 05       | Gala                 | Freed from Desire                |
| 06       | Lou Bega             | Mambo No. 5 (A Little Bit of…)   |
| 07       | The Black Eyed Peas  | I Gotta Feeling                  |
| 08       | Stromae              | Alors on danse                   |
| 09       | Shakira              | Waka Waka (This Time for Africa) |
| 10       | Kool & the Gang      | Celebration                      |
| 11       | Thierry Hazard       | Le Jerk                          |
| 12       | Michel Sardou        | Les Lacs du Connemara            |
