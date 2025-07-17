# Drizzle Database documentation

## How to Run DB

1. run `docker volume create ipix` to create persistant storage
2. run `docker run --name pg -e POSTGRES_USER=myuser -e POSTGRES_PASSWORD=mypwd -e POSTGRES_DB=mydb -v ipix:/var/lib/postgresql/data -p 5432:5432 -d postgres` to build and run postgres database
3. add `postgresql://myuser:mypwd@localhost:5432/mydb` to `.env`

## How to migrate Better-Auth

1. run `npx @better-auth/cli generate --config ..\..\apps\api\src\modules\auth\route.ts --output ./src/schemas/auth.ts`
2. run `npx drizzle-kit generate` to generate the migration file.
3. run `npx drizzle-kit migrate` to apply the migration.
