import { Op } from 'sequelize'
import {
  Table,
  Column,
  Model,
  BelongsTo,
  ForeignKey,
  DataType,
  HasOne,
} from 'sequelize-typescript'

import Campaign from './Campaign.model'
import FollowUp from './FollowUp.model'
import Lead from './Lead.model'
import CallLog from './CallLog.model'

export enum ProgressStatus {
  NEXT = 'Next',
  WAITING = 'Waiting',
  COMPLETE = 'Complete',
  SKIP = 'Skip',
}

@Table
class FollowupProgress extends Model<FollowupProgress> {
  @Column({
    type: DataType.INTEGER({ decimals: 2 }),
  })
  step: number

  @Column({
    type: DataType.ENUM('Waiting', 'Next', 'Complete', 'Skip'),
    defaultValue: ProgressStatus.WAITING,
  })
  progress: ProgressStatus

  @Column
  estimatedTime: Date

  @Column({
    defaultValue: 1,
  })
  LeadInteractionId: number

  // follow up
  @BelongsTo(() => FollowUp, {
    onDelete: 'CASCADE',
  })
  FollowUp: FollowUp

  @ForeignKey(() => FollowUp)
  @Column
  FollowUpId: number

  // lead
  @BelongsTo(() => Lead, {
    onDelete: 'CASCADE',
  })
  Lead: Lead

  @ForeignKey(() => Lead)
  @Column
  LeadId: number

  @HasOne(() => CallLog)
  CallLog: CallLog

  async scheduleNext() {
    // check if there is next running
    const isNextExist = await FollowupProgress.count({
      where: {
        LeadId: this.LeadId,
        progress: ProgressStatus.NEXT,
        LeadInteractionId: this.LeadInteractionId,
      },
    })

    if (isNextExist) {
      return
    }

    const nextProgress = await FollowupProgress.findOne({
      where: {
        LeadId: this.LeadId,
        progress: ProgressStatus.WAITING,
        LeadInteractionId: this.LeadInteractionId,
        FollowUpId: {
          [Op.ne]: null,
        },
      },
      include: [
        FollowUp,
        {
          model: Lead,
          include: [Campaign],
        },
      ],
      order: [['step', 'asc']],
    })
    if (nextProgress) {
      const campaign = nextProgress.Lead.Campaign
      if (nextProgress.FollowUp) {
        const estimatedTime = nextProgress.FollowUp.getTime()

        await nextProgress.update({
          estimatedTime: campaign.getEstimatedTime(estimatedTime),
          progress: ProgressStatus.NEXT,
        })
      } else {
        console.log(`follow up not found id=${nextProgress.id}`)
      }
    }
  }
}

export default FollowupProgress
