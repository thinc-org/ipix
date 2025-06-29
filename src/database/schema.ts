import { relations } from 'drizzle-orm'
import {
    sqliteTable,
    text,
    integer
} from 'drizzle-orm/sqlite-core'

import { createId } from '@paralleldrive/cuid2'

export const user = sqliteTable(
    'user',
    {
        id: text('id')
            .$defaultFn(() => createId())
            .primaryKey(),
        name: text('name').notNull(),
        email: text('email').notNull().unique(),
        emailVerified: integer('emailVerified').notNull(),
        image: text('image'),
        createdAt: text('createdAt').notNull(),
        updatedAt: text('updatedAt').notNull(),
    }
)

export const session = sqliteTable(
    'session',
    {
        id: text('id')
            .$defaultFn(() => createId())
            .primaryKey(),
        expiresAt: text('expiresAt').notNull(),
        token: text('token').notNull().unique(),
        createdAt: text('createdAt').notNull(),
        updatedAt: text('updatedAt').notNull(),
        ipAddress: text('ipAddress'),
        userAgent: text('userAgent'),
        userId: text('userId').notNull().references(() => user.id),
    }
)

export const account = sqliteTable(
    'account',
    {
        id: text('id')
            .$defaultFn(() => createId())
            .primaryKey(),
        accountId: text('accountId').notNull(),
        providerId: text('providerId').notNull(),
        userId: text('userId').notNull().references(() => user.id),
        accessToken: text('accessToken'),
        refreshToken: text('refreshToken'),
        idToken: text('idToken'),
        accessTokenExpiresAt: text('accessTokenExpiresAt'),
        refreshTokenExpiresAt: text('refreshTokenExpiresAt'),
        scope: text('scope'),
        password: text('password'),
        createdAt: text('createdAt').notNull(),
        updatedAt: text('updatedAt').notNull(),
    }
)

export const verification = sqliteTable(
    'verification',
    {
        id: text('id')
            .$defaultFn(() => createId())
            .primaryKey(),
        identifier: text('identifier').notNull(),
        value: text('value').notNull(),
        expiresAt: text('expiresAt').notNull(),
        createdAt: text('createdAt'),
        updatedAt: text('updatedAt'),
    }
)

export const table = {
    user,
    session,
    account,
    verification
}