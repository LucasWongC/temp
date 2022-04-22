import winston from 'winston'
const { combine, timestamp, prettyPrint } = winston.format

const logger = winston.createLogger({
  format: combine(timestamp(), prettyPrint()),
  defaultMeta: { service: 'user-service' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      level: 'info',
    }),
  ],
})

export default logger
