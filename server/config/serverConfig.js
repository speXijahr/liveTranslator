// server/config/serverConfig.js
require('dotenv').config();

const PORT = process.env.PORT || 8080;

module.exports = {
    PORT,
    NODE_ENV: process.env.NODE_ENV || 'development',
    ROOM_CREATION_ADMIN_SECRET: process.env.ROOM_CREATION_ADMIN_SECRET // Load the secret
};