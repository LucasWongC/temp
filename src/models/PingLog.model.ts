import {
  Table,
  Column,
  Model,
  ForeignKey,
  BelongsTo,
  DataType,
} from 'sequelize-typescript'

import Integration from './Integration.model'
import Lead from './Lead.model'
import TransferNumber from './TransferNumber.model'

@Table({
  updatedAt: false,
})
class PingLog extends Model<PingLog> {
  @Column({
    type: DataType.STRING(500),
  })
  result: string

  // transfer
  @BelongsTo(() => TransferNumber, {
    onDelete: 'CASCADE',
  })
  TransferNumber: TransferNumber

  @ForeignKey(() => TransferNumber)
  @Column
  TransferNumberId: number

  // lead
  @BelongsTo(() => Lead, {
    onDelete: 'CASCADE',
  })
  Lead: Lead

  @ForeignKey(() => Lead)
  @Column
  LeadId: number

  // Integration
  @BelongsTo(() => Integration, {
    onDelete: 'CASCADE',
  })
  Integration: Integration

  @ForeignKey(() => Integration)
  @Column
  IntegrationId: number
}

export default PingLog
