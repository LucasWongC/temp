import {
  Table,
  Column,
  DataType,
  Model,
  BelongsTo,
  ForeignKey,
} from 'sequelize-typescript'
import Integration from './Integration.model'

@Table({
  timestamps: false,
})
class Agent extends Model<Agent> {
  @Column({
    allowNull: false,
  })
  name: string

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  get states() {
    const value: any = this.getDataValue('states')
    return value ? value.split(',') : []
  }
  set states(value) {
    this.setDataValue('states', value.join(','))
  }

  @Column({
    allowNull: false,
  })
  phone: string

  @Column
  agentId: string

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 18,
  })
  startAge: number

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 100,
  })
  endAge: number

  @BelongsTo(() => Integration, {
    onDelete: 'SET NULL',
  })
  Integration: Integration

  @ForeignKey(() => Integration)
  @Column
  IntegrationId: number
}

export default Agent
