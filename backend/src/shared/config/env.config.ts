// Central place to read environment variables, per docs/deployment/docker-compose.md §5.
// No @nestjs/config dependency — that wasn't part of the decided dependency set
// (see openspec/changes/backend-walking-skeleton/design.md), and plain process.env
// reads are enough at this scale.

export const env = {
  port: Number(process.env.PORT ?? 3000),
  mongodbUri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/ifoc',
  kafkaBrokers: (process.env.KAFKA_BROKERS ?? 'localhost:9093').split(','),
  kafkaTopicMachineEvents:
    process.env.KAFKA_TOPIC_MACHINE_EVENTS ?? 'machine.events',
  // Insight Service LLM configuration, per docs/deployment/docker-compose.md §5.
  // Defaults to the built-in "mock" provider so local dev and the demo run
  // without an API key; real adapters read llmApiKey/llmModel.
  llmProvider: process.env.LLM_PROVIDER ?? 'mock',
  llmApiKey: process.env.LLM_API_KEY ?? '',
  llmModel: process.env.LLM_MODEL ?? '',
};
