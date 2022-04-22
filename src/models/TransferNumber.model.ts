import {
  Table,
  Column,
  DataType,
  Model,
  ForeignKey,
  BelongsTo,
  BeforeCreate,
  HasMany,
} from 'sequelize-typescript'

import Optimize from '../services/optimize'
import logger from '../services/logger'
import Agent from './Agent.model'
import TransferOption from './TransferOption.model'
import CallLog from './CallLog.model'
import Integration, { IntegrationPartners } from './Integration.model'
import Lead from './Lead.model'
import PingLog from './PingLog.model'

@Table({
  updatedAt: false,
})
class TransferNumber extends Model<TransferNumber> {
  @Column
  name: string

  @Column
  phone: string

  @Column({
    type: DataType.ENUM('Internal Agents', 'Manual'),
    allowNull: false,
    defaultValue: 'Manual',
  })
  source: string

  @Column({
    defaultValue: true,
    allowNull: false,
  })
  active: boolean

  @Column({
    type: DataType.INTEGER({ decimals: 2 }),
    defaultValue: 0,
  })
  order: number

  // transfer option
  @BelongsTo(() => TransferOption, {
    onDelete: 'CASCADE',
  })
  TransferOption: TransferOption

  @ForeignKey(() => TransferOption)
  @Column
  TransferOptionId: number

  // agent
  @BelongsTo(() => Agent, {
    onDelete: 'CASCADE',
  })
  Agent: Agent

  @ForeignKey(() => Agent)
  @Column
  AgentId: number

  // integration
  @BelongsTo(() => Integration, {
    onDelete: 'SET NULL',
  })
  Integration: Integration

  @ForeignKey(() => Integration)
  @Column
  IntegrationId: number

  @HasMany(() => CallLog)
  CallLogs: CallLog[]

  @BeforeCreate
  static async setOrder(transferNumber) {
    const lastOrder: number =
      (await TransferNumber.max('order', {
        where: { TransferOptionId: transferNumber.TransferOptionId },
      })) || 0

    transferNumber.order = lastOrder + 1
  }

  async ping(lead: Lead) {
    if (!this.Integration) {
      return
    }

    try {
      let result = null
      if (this.Integration.partner === IntegrationPartners.OPTIMIZE) {
        const optimize = new Optimize(this.Integration.apiKey)
        result = await optimize.ping({
          phone: lead.phone,
          optimizeId: lead.optimizeID,
          date: new Date().toISOString(),
        })
      }

      await PingLog.create({
        result,
        TransferNumberId: this.id,
        LeadId: lead.id,
        IntegrationId: this.Integration.id,
      })
    } catch (e) {
      logger.error({
        func: 'ping optimize',
        lead: lead.id,
        integration: this.Integration.id,
      })
    }
  }
}

export default TransferNumber
