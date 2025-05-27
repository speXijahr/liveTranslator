// server/config/corsConfig.js
const { NODE_ENV } = require('./serverConfig');

const corsOptions = {
    origin: NODE_ENV === 'production'
        ? true // Or your specific production domain
        : "http://localhost:3000", // Allow React dev server
    methods: ["GET", "POST"],
    credentials: true
};

module.exports = corsOptions;