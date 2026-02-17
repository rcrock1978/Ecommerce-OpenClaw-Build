import { Kafka, Producer, Consumer } from 'kafkajs';
export declare function getKafkaClient(): Kafka;
export declare function getKafkaProducer(): Promise<Producer>;
export declare function getKafkaConsumer(): Promise<Consumer>;
export declare function disconnectKafka(): Promise<void>;
//# sourceMappingURL=kafka.d.ts.map