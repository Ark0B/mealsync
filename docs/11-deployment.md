# 11 · Deployment

Owner: Tarun (DevOps).

## Environments
| Env | Database | Payments | Purpose |
|---|---|---|---|
| Local | SQLite file `database/mealsync.db` | mock | development, demos |
| CI | in-memory SQLite + MySQL 8 service container | mock | every push / PR |
| Production | MySQL 8 (managed or campus) | mock until the university has a merchant account | real use |

## Environment variables
See `.env.example`. In production set **all** of: `NODE_ENV=production`, `DB_CLIENT=mysql`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `PASS_SECRET`, `PAYMENT_MODE`, `PAYMENT_SECRET`, `INSTITUTION_NAME`. Generate secrets with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. `JWT_SECRET` and `PASS_SECRET` must differ.

## Render (example host)
1. Create a MySQL 8 database (Aiven / Railway / campus). Create a database `mealsync` and a user with rights **only** on it (least privilege).
2. Render → *New Web Service* → connect the GitHub repo → Runtime Node, Build `npm ci`, Start `npm start`, Health check path `/api/health`.
3. Add the environment variables above (Render provides `PORT`).
4. Enable auto-deploy on `main` **after CI passes**.
5. First deploy: open the Render shell and run `npm run seed -- --no-demo` (creates the tables and loads plans, prices and the menu, **without** demo users).
6. Create the first admin: `npm run create-admin -- admin@youruni.edu "Mess Admin" '<strong password>'`. Log in, then create the manager and staff accounts from *Staff & committee*.

## Campus VM alternative
Node 22 + `pm2 start src/server.js --name mealsync`, behind the campus Nginx with HTTPS. Same environment variables.

## Backups
Daily `mysqldump` of the `mealsync` database (managed hosts do this automatically). The money tables (`payments`, `wallet_transactions`, `subscriptions`) and `meal_logs` are the critical ones.
