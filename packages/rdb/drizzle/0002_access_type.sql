-- Custom SQL migration file, put your code below! --

CREATE TYPE "access_type" AS ENUM('public', 'team', 'owner');
CREATE TYPE "item_type" AS ENUM('file', 'folder');
CREATE TYPE "space_type" AS ENUM('personal', 'team');