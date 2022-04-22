import {
  Table,
  Column,
  Model,
  BelongsTo,
  ForeignKey,
  DataType,
} from 'sequelize-typescript'

import Campaign from './Campaign.model'

export enum FollowupGroupType {
  DEFAULT = 'Default',
  INBOUND_CALL = 'InboundCall',
  INBOUND_SMS = 'InboundSMS',
  SCHEDULE = 'Schedule',
}

@Table({
  updatedAt: false,
})
class FollowupGroup extends Model<FollowupGroup> {
  @Column({
    allowNull: false,
  })
  name: string

  @Column({
    type: DataType.ENUM('Default', 'InboundCall', 'InboundSMS', 'Schedule'),
    defaultValue: FollowupGroupType.DEFAULT,
  })
  type: FollowupGroupType

  @Column({
    defaultValue: false,
  })
  knownOnly: boolean

  @BelongsTo(() => Campaign, {
    onDelete: 'CASCADE',
  })
  Campaign: Campaign

  @ForeignKey(() => Campaign)
  @Column
  CampaignId: number
}

export default FollowupGroup
