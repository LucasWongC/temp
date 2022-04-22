import {
  Table,
  Column,
  Model,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript'
import sequelize from 'sequelize'

import Campaign from './Campaign.model'

@Table
class PhoneNumber extends Model<PhoneNumber> {
  @Column({
    allowNull: false,
  })
  source: string

  @Column({
    allowNull: false,
  })
  number: string

  @Column({
    allowNull: false,
    defaultValue: true,
  })
  active: boolean

  // campaign
  @BelongsTo(() => Campaign, {
    onDelete: 'CASCADE',
  })
  Campaign: Campaign

  @ForeignKey(() => Campaign)
  @Column
  CampaignId: number

  static async getAvailableOne(campaignId) {
    const sql = `
      SELECT PhoneNumbers.id, PhoneNumbers.number
      FROM PhoneNumbers
      WHERE PhoneNumbers.CampaignId=${campaignId} AND PhoneNumbers.active = 1
      ORDER BY RAND()
      LIMIT 1
    `
    const [number] = await PhoneNumber.sequelize.query(sql, {
      type: sequelize.QueryTypes.SELECT,
    })

    return number
  }
}

export default PhoneNumber
