# Simpsons Picker

Pick a Simpsons character and save your selection. Each user can hold one character; once it's claimed, everyone else sees it as **Taken by {display name}**. Only admins can release or reassign a claim, or manage users.

Character data comes from [The Simpsons API](https://thesimpsonsapi.com) (about 1,180 characters).

## Stack

- Next.js 16 (App Router) + TypeScript
- SQLite via Drizzle ORM + `better-sqlite3`
- Email/password auth with server-side sessions (scrypt password hashes, HttpOnly cookie)

## Requirements

- Node.js 22+ (required by `better-sqlite3`; tested on Node 22.23 LTS) and npm

## Run it

```bash
npm install
cp .env.example .env.local     # Windows PowerShell: Copy-Item .env.example .env.local
# edit .env.local: set ADMIN_EMAIL and a strong ADMIN_PASSWORD
npm run dev                    # http://localhost:3000
```

Production:

```bash
npm run build
npm start
```

The first request that needs characters fetches all 60 API pages (a few seconds) and writes them to `data/characters-cache.json`. After that the list is served from memory and the file, and refreshed in the background once it is older than `CHARACTER_CACHE_TTL_HOURS`.

## Admin account

On first boot the app creates an admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD` (display name from `ADMIN_DISPLAY_NAME`, default `Admin`). If a user with that email already exists, it is promoted to admin and its password is left unchanged. Changing `ADMIN_PASSWORD` later does not update an existing account.

Log in with those credentials and open **Admin** in the header to:

- create a user (email, display name, password, and role `user` or `admin`),
- promote or demote a user (the last remaining admin cannot be demoted),
- remove a user, which also releases their claim (you cannot remove yourself or the last remaining admin),
- release any claim, and
- assign a character to a user. This removes the user's current claim and the character's current owner, if any.

Click a character in the carousel or search results to open `/characters/[id]`, with the portrait, age, birthdate, gender, occupation, status, phrases, and the same claim rules as the cards.

## Configuration (`.env.local`)

| Variable | Default | Purpose |
|---|---|---|
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | none | Seeded admin account |
| `ADMIN_DISPLAY_NAME` | `Admin` | Admin's display name |
| `DATABASE_PATH` | `./data/app.db` | SQLite file (tables are created automatically) |
| `CHARACTER_CACHE_PATH` | `./data/characters-cache.json` | Character list cache |
| `CHARACTER_CACHE_TTL_HOURS` | `24` | Cache refresh interval |

To reset everything, stop the server and delete the `data/` folder.

## API

| Method | Path | Auth | |
|---|---|---|---|
| POST | `/api/auth/register` | none | `{ email, password, displayName }` |
| POST | `/api/auth/login` | none | `{ email, password }` |
| POST | `/api/auth/logout` | session | |
| GET | `/api/auth/me` | none | Current user and their claim |
| GET | `/api/characters?q=&limit=&offset=` | none | Name search over the cached list, with claim info |
| GET | `/api/characters/carousel?start=&size=` | none | Wrapping window for the carousel |
| GET / POST | `/api/claims` | user | Your claim / claim `{ characterId }` (one per user) |
| GET / POST | `/api/admin/claims` | admin | List claims and users / force-assign `{ userId, characterId }` |
| DELETE | `/api/admin/claims/:characterId` | admin | Release a claim |
| POST | `/api/admin/users` | admin | Create `{ email, displayName, password, role }` |
| PATCH | `/api/admin/users/:id` | admin | Set `{ role }` (`user` or `admin`) |
| DELETE | `/api/admin/users/:id` | admin | Remove a user and release their claim |

Mutating endpoints only accept same-origin `application/json` requests.

## Smoke test

With the server running (and `.env.local` holding the admin credentials):

```bash
BASE_URL=http://localhost:3000 npm run smoke
```

This registers two throwaway users and checks login, search, the carousel, the one-claim rule, the "taken" display, and the admin release and assign actions.
