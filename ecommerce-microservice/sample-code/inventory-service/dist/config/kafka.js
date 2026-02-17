"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getKafkaClient = getKafkaClient;
exports.getKafkaProducer = getKafkaProducer;
exports.getKafkaConsumer = getKafkaConsumer;
exports.disconnectKafka = disconnectKafka;
const kafkajs_1 = require("kafkajs");
const logger_1 = __importDefault(require("../utils/logger"));
let kafka;
let producer;
let consumer;
function getKafkaClient() {
    if (!kafka) {
        kafka = new kafkajs_1.Kafka({
            clientId: 'order-service',
            brokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(','),
        });
    }
    return kafka;
}
async function getKafkaProducer() {
    if (!producer) {
        producer = getKafkaClient().producer();
        await producer.connect();
        logger_1.default.info('Kafka producer connected');
    }
    return producer;
}
async function getKafkaConsumer() {
    if (!consumer) {
        consumer = getKafkaClient().consumer({ groupId: 'order-service-group' });
        await consumer.connect();
        logger_1.default.info('Kafka consumer connected');
    }
    return consumer;
}
async function disconnectKafka() {
    if (producer) {
        await producer.disconnect();
    }
    if (consumer) {
        await consumer.disconnect();
    }
}
//# sourceMappingURL=kafka.js.map