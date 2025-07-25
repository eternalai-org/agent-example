import { Mutex } from 'async-mutex';
import { DataTypes, Sequelize } from 'sequelize';

export const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: `${process.env.STORAGE_PATH}/sqlite.db`,
    pool: { max: 1, idle: Infinity, maxUses: Infinity },
    logging: false,
});

export const DiscordServers = sequelize.define(
    'discord_servers',
    {
        id: {
            type: DataTypes.STRING,
            primaryKey: true,
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        }
    },
    {
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    },
);


export const DiscordChannels = sequelize.define(
    'discord_channels',
    {
        id: {
            type: DataTypes.STRING,
            primaryKey: true,
        },
        server_id: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        }
    },
    {
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                fields: ['server_id'],
            },
        ]
    },
);

export const DiscordMessages = sequelize.define(
    'discord_messages',
    {
        id: {
            type: DataTypes.STRING,
            primaryKey: true,
        },
        server_id: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        channel_id: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        channel: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        author_id: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        author: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        bot: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
        },
        content: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        timestamp: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        reply_to_id: {
            type: DataTypes.STRING,
            allowNull: true,
        },
    },
    {
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                fields: ['channel_id'],
            },
            {
                fields: ['timestamp'],
            },
            {
                fields: ['bot'],
            }
        ]
    },
);

export const DiscordSummaries = sequelize.define(
    'discord_summaries',
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        server_id: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        channel_id: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        summary: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        num_messages: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        from_timestamp: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        to_timestamp: {
            type: DataTypes.DATE,
            allowNull: false,
        },
    },
    {
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                fields: ['channel_id'],
            },
            {
                fields: ['from_timestamp'],
            },
            {
                fields: ['to_timestamp'],
            }
        ]
    },
);

export const syncDB = async () => {
    await sequelize.sync({ force: false });
    console.log('Synced DB');
}