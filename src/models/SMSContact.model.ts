import {
  Table,
  Column,
  DataType,
  Model,
  BelongsTo,
  ForeignKey,
} from 'sequelize-typescript'
import CallLog from './CallLog.model'
import Lead from './Lead.model'
import User from './User.model'

@Table
class SMSContact extends Model<SMSContact> {
  @Column({
    type: DataType.TEXT,
  })
  lastMessage: string

  @Column({
    defaultValue: 0,
  })
  unreadCount: number

  @Column({
    defaultValue: false,
  })
  archived: boolean

  // lead
  @BelongsTo(() => Lead, {
    onDelete: 'CASCADE',
  })
  Lead: Lead

  @ForeignKey(() => Lead)
  @Column
  LeadId: number

  // user
  @BelongsTo(() => User, {
    onDelete: 'SET NULL',
  })
  User: User

  @ForeignKey(() => User)
  @Column
  UserId: number

  // call log
  @BelongsTo(() => CallLog, {
    onDelete: 'SET NULL',
  })
  CallLog: CallLog

  @ForeignKey(() => CallLog)
  @Column
  CallLogId: number
}

export default SMSContact
