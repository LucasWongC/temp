import fs from 'fs'
import randtoken from 'rand-token'
import moment from 'moment'
import {
  Table,
  Column,
  Model,
  BelongsTo,
  ForeignKey,
  DataType,
  BeforeSave,
} from 'sequelize-typescript'

import { storagePath } from '../helpers'
import textToSpeech, { getGoogleSSML } from '../services/textToSpeech'
import Campaign from './Campaign.model'
import FollowupGroup from './FollowupGroup.model'
import IVR from './IVR.model'

export enum FollowupType {
  CALL = 'Call',
  SEND_SMS = 'SendSMS',
  ACTIVATE_VOICE = 'ActivateVoice',
  NEW_CHAT = 'NewChat',
  SEND_YTEL = 'SendYtel',
  SCHEDULE = 'Schedule',
}
@Table({
  updatedAt: false,
})
class FollowUp extends Model<FollowUp> {
  @Column({
    type: DataType.ENUM(
      'Call',
      'SendSMS',
      'ActivateVoice',
      'NewChat',
      'SendYtel',
      'Schedule'
    ),
  })
  type: FollowupType

  @Column
  hours: number

  @Column
  minutes: number

  @Column
  seconds: number

  @Column({
    allowNull: false,
    defaultValue: false,
    comment: 'leaveVoiceMail/randomAgent',
  })
  leaveVoiceMail: boolean

  @Column({
    type: DataType.TEXT,
  })
  mailText: string

  @Column
  mailAudio: string

  @Column
  incoming: boolean

  @Column({
    defaultValue: 100,
  })
  order: number

  // campaign
  @BelongsTo(() => Campaign, {
    onDelete: 'CASCADE',
  })
  Campaign: Campaign

  @ForeignKey(() => Campaign)
  @Column
  CampaignId: number

  // follow up group
  @BelongsTo(() => FollowupGroup, {
    onDelete: 'CASCADE',
  })
  FollowupGroup: FollowupGroup

  @ForeignKey(() => FollowupGroup)
  @Column
  FollowupGroupId: number

  // ivr
  @BelongsTo(() => IVR, {
    onDelete: 'SET NULL',
  })
  IVR: IVR

  @ForeignKey(() => IVR)
  @Column
  IVRId: number

  getTime(basicTime?) {
    const estimatedTime = moment(basicTime || new Date())
      .add(this.hours, 'hours')
      .add(this.minutes, 'minutes')
      .add(this.seconds, 'seconds')
      .format('YYYY-MM-DD HH:mm:ss')

    return estimatedTime
  }

  async generateAudio() {
    // remove the old audio
    if (this.mailAudio) {
      try {
        fs.unlinkSync(storagePath(this.mailAudio))
      } catch {}
    }

    // create a new audio
    try {
      this.mailAudio = `followupAudios/${randtoken.generate(30)}.mp3`
      await textToSpeech(
        getGoogleSSML(this.mailText),
        storagePath(this.mailAudio)
      )
    } catch (e) {
      this.mailAudio = null
    }
  }

  // create the audio file of the prompt
  @BeforeSave
  static async runGenerateAudio(followUp) {
    if (followUp.leaveVoiceMail && followUp.changed('mailText')) {
      await followUp.generateAudio()
    }
  }
}

export default FollowUp
