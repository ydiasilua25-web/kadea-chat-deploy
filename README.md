# Kadea Chat

Application de messagerie web réalisée pour Kadea Academy dans le cadre du capstone de fin de formation. Les utilisateurs échangent en privé ou en groupe, reçoivent leurs messages en temps réel, et retrouvent leurs conversations à chaque connexion.

- **Site hébergé :** (adresse Render, `https://kadea-chat-yorgen.onrender.com`)
- **Dépôt GitHub :** `https://github.com/kadea-academy-learners/26-01-kd-dev-web-matin-c-mon-thu-kin-capstone-kadea-chat-ydiasilua25-web/tree/main/kadea-chat-dev-web`
- **Remarque :** le site est hébergé sur une offre gratuite. Après un moment d'inactivité, la première ouverture peut prendre jusqu'à une minute.

## Technologies

| Rôle | Choix |
|---|---|
| Framework | AdonisJS 7 (MVC), TypeScript |
| Vues | Edge (layouts, composants, partiels) |
| Base de données | PostgreSQL, ORM Lucid |
| Temps réel | Transmit (Server-Sent Events) |
| Interface | Tailwind CSS 4 et CSS du kit, thème clair et sombre, responsive |
| E-mails | API de Brevo |
| Hébergement | Render (application), Neon (PostgreSQL) |

## Fonctionnalités réalisées

**Comptes**
- Inscription avec nom, adresse e-mail et mot de passe (haché)
- E-mail de confirmation avec lien à usage unique ; connexion refusée tant que l'adresse n'est pas confirmée
- Connexion, déconnexion (avec confirmation), mot de passe oublié par lien valable une heure
- Profil : modification du nom et du mot de passe
- Page de bienvenue affichée une seule fois, après la première connexion

**Conversations et messages**
- Recherche d'un utilisateur et démarrage d'une conversation privée (une seule par paire d'utilisateurs)
- Liste des conversations avec dernier message et heure
- Envoi et réception de messages en temps réel, sans recharger la page
- Historique conservé après déconnexion ou rechargement
- Modification d'un message, suppression pour tous (une indication remplace le message), suppression pour soi seulement
- Accès aux conversations et aux messages vérifié côté serveur (réponse 404 pour un non-membre)

**Groupes**
- Création d'un groupe avec un nom et plusieurs membres ; le créateur est administrateur
- L'administrateur ajoute et retire des membres ; seuls les membres lisent les messages

**Interface**
- Disposition à colonnes sur ordinateur, barre de navigation en bas et vues successives sur téléphone
- Thème clair et sombre, page d'accueil, formulaires responsives

**Fonctionnalités avancées** (cocher à la fin du projet)
- [ ] Statuts des messages (envoyé, reçu, lu) et messages non lus
- [ ] Présence en ligne et indicateur « est en train d'écrire »
- [ ] Blocage et déblocage d'un utilisateur
- [ ] Recherche dans les messages
- [ ] Partage d'images et de documents (type et taille vérifiés)
- [ ] Photo de profil

## Installation en local

**Prérequis :** Node.js 24 ou plus, PostgreSQL, Git.

```bash
git clone <https://github.com/kadea-academy-learners/26-01-kd-dev-web-matin-c-mon-thu-kin-capstone-kadea-chat-ydiasilua25-web/tree/main/kadea-chat-dev-web>
cd kadea-chat-dev-web
npm install
cp .env.example .env
```

1. Crée une base PostgreSQL vide (par exemple `kadea_chat_dev`).
2. Génère une clé d'application et colle-la dans `APP_KEY` :

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. Renseigne les autres variables de `.env` (voir le tableau ci-dessous).
4. Crée les tables, puis lance l'application :

   ```bash
   node ace migration:run
   npm run dev
   ```

L'application est disponible sur `http://localhost:3333`.

**Comptes de test (local uniquement) :** `node ace db:seed` crée cinq comptes déjà confirmés.

## Variables d'environnement

Les valeurs secrètes ne sont jamais dans le dépôt : elles se renseignent dans `.env` (local) et dans l'interface de l'hébergeur (production).

| Variable | Rôle |
|---|---|
| `NODE_ENV` | `development`, `production` ou `test` |
| `TZ` | Fuseau horaire du serveur (`UTC`) |
| `HOST`, `PORT` | Adresse et port d'écoute (`0.0.0.0` en production) |
| `LOG_LEVEL` | Niveau des journaux (`info`) |
| `APP_KEY` | Clé secrète de l'application (cookies de session) |
| `APP_URL` | Adresse publique du site, utilisée dans les liens des e-mails |
| `SESSION_DRIVER` | `cookie` |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE` | Connexion PostgreSQL |
| `DB_SSL` | `true` pour une base distante (Neon), `false` en local |
| `BREVO_API_KEY` | Clé d'API de Brevo pour l'envoi des e-mails |
| `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME` | Expéditeur des e-mails (adresse vérifiée chez Brevo) |

## Déploiement

- **Render** (Web Service, Node) : commande de construction `NODE_ENV=development npm install && npm run build && cd build && npm ci --omit=dev` ; commande de démarrage `cd build && node ace migration:run --force && node bin/server.js`. Les migrations s'exécutent à chaque démarrage.
- **Neon** : base PostgreSQL ; les accès sont chiffrés (`DB_SSL=true`).

## Architecture

- `app/models` : modèles Lucid et leurs relations
- `app/controllers` : contrôleurs courts (réception, validation, réponse)
- `app/services` : logique métier (conversations, messages, jetons d'e-mail)
- `app/validators` : validation des données avec VineJS
- `resources/views` : layouts, composants et pages Edge
- `resources/js/chat.js` : temps réel, envoi sans rechargement, menus
- `start/routes.ts` : routes, avec le middleware d'authentification

## Sécurité

- Mots de passe hachés ; les jetons de confirmation et de réinitialisation ne sont stockés que sous forme d'empreinte, valables une seule fois et pour une durée limitée.
- Droits vérifiés à chaque action : membre d'une conversation, auteur d'un message, administrateur d'un groupe.
- Protection CSRF sur tous les formulaires ; seules les routes d'abonnement au temps réel en sont exclues.
- Chaque utilisateur ne peut écouter que son propre canal temps réel.
- Les contenus affichés sont échappés par Edge.

## Base de données

Schéma complet : `docs/schema.png` (source : `docs/schema.dbml`). Tables principales : `users`, `conversations`, `conversation_members`, `messages`, avec `email_tokens`, `message_hides`, `attachments` et `blocks`.