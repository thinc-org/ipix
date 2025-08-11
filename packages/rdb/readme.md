# Drizzle Database documentation

## How to Run DB

1. run `docker run --name pg-ipix -e POSTGRES_USER=myuser -e POSTGRES_PASSWORD=mypwd -e POSTGRES_DB=postgres -e POSTGRES_INITDB_ARGS="--encoding=UTF8 --locale-provider=icu --icu-locale=und-x-icu" -v ipix:/var/lib/postgresql/data -p 5432:5432 -d postgres:17.5` to build and run postgres database
2. run `docker exec -it pg-ipix psql -U myuser -d postgres -c "SELECT datname, encoding, datlocprovider, datlocale, datcollversion FROM pg_database WHERE datname='postgres';"` and see if your output match the table below:

```txt
datname  | encoding | datlocprovider | datlocale | datcollversion 
----------+----------+----------------+-----------+----------------
 postgres |        6 | i              | und-x-icu | 153.120
(1 row)
```

refer to: https://www.postgresql.org/docs/current/collation.html#COLLATION-MANAGING-PREDEFINED-ICU-UND-X-ICU

3. add `postgresql://myuser:mypwd@localhost:5432/postgres` to `.env`

## How to migrate Better-Auth

1. cd to this directory (`cd ./packages/rdb` if you're at root)
2. run `npx drizzle-kit migrate` to apply the migration.
3. Done!

## Override Command

- run `npx drizzle-kit generate` to generate the migration file.
- run `npx @better-auth/cli generate --config ..\..\apps\api\src\modules\auth\route.ts --output ./src/schemas/auth.ts` to generate schemas file
