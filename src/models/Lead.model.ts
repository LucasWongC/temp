import { Op } from 'sequelize'
import objectPath from 'object-path'
import {
  Table,
  Column,
  DataType,
  Model,
  BelongsTo,
  ForeignKey,
  BeforeCreate,
  AfterCreate,
  HasMany,
} from 'sequelize-typescript'

import logger from '../services/logger'
import pusher from '../services/pusher'
import twilio from '../services/twilio'
import Campaign from './Campaign.model'
import FollowupProgress, { ProgressStatus } from './FollowupProgress.model'
import FollowUp, { FollowupType } from './FollowUp.model'
import CallLog from './CallLog.model'

export enum LeadType {
  MOBILE = 'Mobile',
  LANDLINE = 'Landline',
}

export enum LeadStatus {
  NOT_CALLED = 'Not Called',
  CALLED = 'Called',
  CONTACTED = 'Contacted',
  REMOVED = 'Removed',
  TRANSFERRED = 'Transferred',
}

@Table
class Lead extends Model<Lead> {
  @Column({
    allowNull: false,
  })
  firstName: string

  @Column({
    allowNull: false,
  })
  lastName: string

  @Column
  email: string

  @Column({
    allowNull: false,
  })
  phone: string

  @Column({
    type: DataType.ENUM('Mobile', 'Landline'),
    defaultValue: 'Mobile',
  })
  type: LeadType

  @Column({
    type: DataType.STRING(10),
  })
  zipCode: string

  @Column
  city: string

  @Column
  state: string

  @Column
  location: string

  @Column
  timezone: string

  @Column
  age: number

  @Column
  optimizeID: string

  @Column({
    defaultValue: false,
  })
  blocked: boolean

  @Column({
    defaultValue: 1,
  })
  currentInteraction: number

  @Column({
    type: DataType.ENUM(
      'Not Called',
      'Called',
      'Contacted',
      'Transferred',
      'Removed'
    ),
    defaultValue: LeadStatus.NOT_CALLED,
    allowNull: false,
  })
  status: LeadStatus

  @BelongsTo(() => Campaign, {
    onDelete: 'CASCADE',
  })
  Campaign: Campaign

  @ForeignKey(() => Campaign)
  @Column
  CampaignId: number

  @HasMany(() => FollowupProgress)
  FollowupProgresses: FollowupProgress[]

  @HasMany(() => CallLog)
  CallLogs: CallLog[]

  async createProgresses(
    FollowupGroupId,
    includeIncoming = false,
    startTime = null
  ) {
    const campaign: Campaign = (await this.$get('Campaign')) as any

    // make all next progress as waiting
    await FollowupProgress.update(
      { progress: ProgressStatus.SKIP },
      {
        where: {
          LeadId: this.id,
          progress: {
            [Op.or]: [ProgressStatus.NEXT, ProgressStatus.WAITING],
          },
        },
      }
    )

    // get sequences of the followup group
    const where: any = includeIncoming
      ? { FollowupGroupId }
      : { FollowupGroupId, incoming: 0 }

    // skip SMS progresses if landline
    if (this.type === LeadType.LANDLINE) {
      where.type = { [Op.ne]: FollowupType.SEND_SMS }
    }

    const followups = await FollowUp.findAll({
      where,
      order: [['incoming', 'DESC'], ['order', 'asc']],
    })

    if (!followups.length) {
      throw new Error('No sequences found')
    }

    // create interaction
    const lastInteraction: number = await FollowupProgress.max(
      'LeadInteractionId',
      {
        where: { LeadId: this.id },
      }
    )
    const interactionId = (lastInteraction || 0) + 1

    // add the follow ups
    const progress = []
    let estimatedTime: any = startTime || new Date()

    followups.forEach((followUp, index) => {
      if (!includeIncoming && followUp.incoming) {
        return
      }

      estimatedTime = followUp.getTime(estimatedTime)
      estimatedTime = campaign.getEstimatedTime(estimatedTime)

      // if the schedules not defined
      if (!estimatedTime) {
        return
      }

      progress.push({
        LeadId: this.id,
        FollowUpId: followUp.id,
        LeadInteractionId: interactionId,
        step: index,
        progress:
          index === 0 &&
          ![FollowupType.ACTIVATE_VOICE, FollowupType.NEW_CHAT].includes(
            followUp.type
          )
            ? ProgressStatus.NEXT
            : ProgressStatus.WAITING,
        estimatedTime,
      })
    })

    await FollowupProgress.bulkCreate(progress)

    this.currentInteraction = interactionId
    this.status = LeadStatus.NOT_CALLED
    await this.save()
  }

  @BeforeCreate
  static async setType(lead) {
    try {
      const phone = await twilio.lookups
        .phoneNumbers(lead.phone)
        .fetch({ type: ['carrier'] })

      lead.type =
        objectPath.get(phone, 'carrier.type') === 'mobile'
          ? LeadType.MOBILE
          : LeadType.LANDLINE
    } catch {
      logger.error({
        func: 'lead beforecreate',
        phone: lead.phone,
      })
    }
  }

  @AfterCreate
  static async notifyNewLead() {
    pusher.trigger(`private-updates`, 'forceUpdate', {})
  }
}

export default Lead
