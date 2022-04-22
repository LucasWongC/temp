import { Table, Column, DataType, Model } from 'sequelize-typescript'

export enum IntegrationPartners {
  INTERNAL = 'Internal',
  DIALPAD = 'Dialpad',
  YTEL = 'Ytel',
  OPTIMIZE = 'Optimize',
}

@Table({
  timestamps: false,
})
class Integration extends Model<Integration> {
  @Column({
    allowNull: false,
  })
  name: string

  @Column({
    type: DataType.ENUM('Internal', 'Dialpad', 'Ytel', 'Optimize'),
    allowNull: false,
  })
  partner: IntegrationPartners

  @Column
  accountId: string

  @Column({
    allowNull: false,
  })
  apiKey: string

  @Column
  accountName: string
}

export default Integration
