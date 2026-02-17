export interface Event {
    specversion: string;
    type: string;
    source: string;
    id: string;
    time: string;
    correlation_id?: string;
    data: any;
}
export declare class EventPublisher {
    private kafkaProducer;
    constructor();
    publish(eventType: string, data: any, correlationId?: string): Promise<void>;
    private generateEventId;
}
//# sourceMappingURL=event-publisher.d.ts.map