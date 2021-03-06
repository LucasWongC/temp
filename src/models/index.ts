import { Sequelize } from 'sequelize-typescript'
import config from '../config'

const sequelize = new Sequelize({
  username: config.DB_USERNAME,
  password: config.DB_PASSWORD,
  database: config.DB_DATABASE,
  host: config.DB_HOST,
  dialect: config.DB_CONNECTION,
  modelPaths: [__dirname + '/**/*.model.{js,ts}'],
  logging: false,
})

sequelize.sync()

export default sequelize
