import {
  Table,
  Column,
  DataType,
  Model,
  BelongsTo,
  ForeignKey,
  AfterSave,
} from 'sequelize-typescript'

import pusher from '../services/pusher'
import FollowupProgress from './FollowupProgress.model'
import FollowUp from './FollowUp.model'
import Campaign from './Campaign.model'
import Lead, { LeadStatus } from './Lead.model'
import IVR from './IVR.model'
import PhoneNumber from './PhoneNumber.model'
import TransferNumber from './TransferNumber.model'

export enum CallType {
  OUTBOUND_CALL = 'Outbound Call',
  OUTBOUND_TEXT = 'Outbound Text',
  INBOUND_CALL = 'Inbound Call',
  INBOUND_TEXT = 'Inbound Text',
}

export enum CallEvents {
  INITIATED = 'initiated',
  RINGING = 'ringing',
  ANSWERED = 'answered',
  COMPLETED = 'completed',
}

export enum CallStatus {
  INITIATED = 'initiated',
  QUEUED = 'queued',
  RINGING = 'ringing',
  IN_PROGRESS = 'in-progress',
  CANCELED = 'canceled',
  COMPLETED = 'completed',
  BUSY = 'busy',
  FAILED = 'failed',
  MACHINE_ANSWERED = 'machine_answered',
  LEFT_VOICEMAIL = 'left_voicemail',
  DELIVERED = 'delivered',
}

export enum CallResult {
  NOT_ANSWERED = 'Not Answered',
  ANSWERED = 'Answered',
  TRANSFERRED = 'Transferred',
  REMOVED = 'Removed',
}

@Table({
  timestamps: false,
})
class CallLog extends Model<CallLog> {
  @Column({
    unique: true,
  })
  sid: string

  @Column({
    type: DataType.ENUM(
      'Outbound Call',
      'Outbound Text',
      'Inbound Call',
      'Inbound Text'
    ),
    defaultValue: 'Outbound Call',
  })
  type: CallType

  @Column
  callStatus: string

  @Column({
    allowNull: false,
    defaultValue: 0,
  })
  callDuration: number

  @Column({
    type: DataType.ENUM('Not Answered', 'Answered', 'Transferred', 'Removed'),
    allowNull: false,
    defaultValue: 'Not Answered',
  })
  status: CallResult

  @Column
  startTime: Date

  @Column
  endTime: Date

  @Column({
    defaultValue: 0,
  })
  transferDuration: number

  @Column
  transferStart: Date

  @Column
  transferEnd: Date

  @Column({
    type: DataType.STRING(500),
  })
  recordingUrl: string

  @Column({
    type: DataType.TEXT,
  })
  SMS: string

  @Column({
    defaultValue: 1,
  })
  LeadInteractionId: number

  // campaign
  @BelongsTo(() => Campaign, {
    onDelete: 'CASCADE',
  })
  Campaign: Campaign

  @ForeignKey(() => Campaign)
  @Column
  CampaignId: number

  // Lead
  @BelongsTo(() => Lead, {
    onDelete: 'CASCADE',
  })
  Lead: Lead

  @ForeignKey(() => Lead)
  @Column
  LeadId: number

  // IVR
  @BelongsTo(() => IVR, {
    onDelete: 'SET NULL',
  })
  IVR: IVR

  @ForeignKey(() => IVR)
  @Column
  IVRId: number

  // FollowUp
  @BelongsTo(() => FollowUp, {
    onDelete: 'SET NULL',
  })
  FollowUp: FollowUp

  @ForeignKey(() => FollowUp)
  @Column
  FollowUpId: number

  // FollowupProgress
  @BelongsTo(() => FollowupProgress, {
    onDelete: 'SET NULL',
  })
  FollowupProgress: FollowupProgress

  @ForeignKey(() => FollowupProgress)
  @Column
  FollowupProgressId: number

  // PhoneNumber
  @BelongsTo(() => PhoneNumber, {
    onDelete: 'SET NULL',
  })
  PhoneNumber: PhoneNumber

  @ForeignKey(() => PhoneNumber)
  @Column
  PhoneNumberId: number

  // TransferNumber
  @BelongsTo(() => TransferNumber, {
    onDelete: 'SET NULL',
  })
  TransferNumber: TransferNumber

  @ForeignKey(() => TransferNumber)
  @Column
  TransferNumberId: number

  static async findBySid(sid) {
    const log = await CallLog.findOne({ where: { sid } })

    return log
  }

  // create the audio file of the prompt
  @AfterSave
  static async updateStatus(callLog) {
    // update progress
    if (
      callLog.changed('callStatus') &&
      callLog.callStatus !== CallStatus.INITIATED &&
      callLog.callStatus !== CallStatus.IN_PROGRESS &&
      callLog.callStatus !== CallStatus.DELIVERED
    ) {
      if (
        callLog.status === CallResult.NOT_ANSWERED ||
        callLog.status === CallResult.ANSWERED
      ) {
        const progress = await callLog.getFollowupProgress()
        await progress.scheduleNext()
      }
    }

    // update lead status
    if (callLog.changed('callStatus')) {
      const lead = await Lead.findByPk(callLog.LeadId)

      if (callLog.status === CallResult.TRANSFERRED) {
        lead.status = LeadStatus.TRANSFERRED
      } else if (callLog.status === CallResult.REMOVED) {
        lead.status = LeadStatus.REMOVED
      } else if (callLog.status === CallResult.ANSWERED) {
        lead.status = LeadStatus.CONTACTED
      } else {
        lead.status = LeadStatus.CALLED
      }

      await lead.save()
    }

    // notify to update the dashboard
    pusher.trigger(`private-updates`, 'forceUpdate', {})

    return true
  }
}

export default CallLog
