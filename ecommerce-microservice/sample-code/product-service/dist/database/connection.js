"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.disconnectDatabase = exports.connectDatabase = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const app_1 = require("../config/app");
const logger_1 = require("../utils/logger");
const connectDatabase = async () => {
    try {
        await mongoose_1.default.connect(app_1.config.mongodb.uri, app_1.config.mongodb.options);
        logger_1.logger.info('Connected to MongoDB', {
            uri: app_1.config.mongodb.uri.replace(/\/\/.*@/, '//***:***@'), // Hide credentials in logs
        });
        // Handle connection events
        mongoose_1.default.connection.on('error', (error) => {
            logger_1.logger.error('MongoDB connection error', { error: error.message });
        });
        mongoose_1.default.connection.on('disconnected', () => {
            logger_1.logger.warn('MongoDB disconnected');
        });
        mongoose_1.default.connection.on('reconnected', () => {
            logger_1.logger.info('MongoDB reconnected');
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to connect to MongoDB', { error: error.message });
        throw error;
    }
};
exports.connectDatabase = connectDatabase;
const disconnectDatabase = async () => {
    try {
        await mongoose_1.default.connection.close();
        logger_1.logger.info('Disconnected from MongoDB');
    }
    catch (error) {
        logger_1.logger.error('Error disconnecting from MongoDB', { error: error.message });
        throw error;
    }
};
exports.disconnectDatabase = disconnectDatabase;
//# sourceMappingURL=connection.js.map