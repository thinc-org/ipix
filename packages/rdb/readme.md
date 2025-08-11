# Drizzle Database documentation

## How to Run DB

1. run `docker run --name pg-ipix -e POSTGRES_USER=myuser -e POSTGRES_PASSWORD=mypwd -e POSTGRES_DB=postgres -e POSTGRES_INITDB_ARGS="--encoding=UTF8 --locale-provider=icu --icu-locale=und" -v ipix:/var/lib/postgresql/data -p 5432:5432 -d postgis/postgis:17-3.5` to build and run postgres with PostGIS
2. run `docker exec -it pg-ipix psql -U myuser -d postgres -c "SELECT datname, encoding, datlocprovider, datlocale, datcollversion FROM pg_database WHERE datname='postgres';"` and see if your output match the table below:

```txt
datname  | encoding | datlocprovider | datlocale | datcollversion 
----------+----------+----------------+-----------+----------------
 postgres |        6 | i              | und | 153.120
(1 row)
```

refer to: https://www.postgresql.org/docs/current/collation.html#COLLATION-MANAGING-PREDEFINED-ICU-UND-X-ICU

3. add `postgresql://myuser:mypwd@localhost:5432/postgres` to `.env`

## How to migrate Better-Auth

1. cd to this directory (`cd ./packages/rdb` if you're at root)
2. run `bun drizzle-kit migrate` to apply the migration.
3. Done!

## Override Command

- run `bun drizzle-kit generate` to generate the migration file.
- run `bun @better-auth/cli generate --config ..\..\apps\api\src\modules\auth\route.ts --output ./src/schemas/auth.ts` to generate schemas file

## Useful Drizzle command
- `bun drizzle-kit generate --custom --name=sth`