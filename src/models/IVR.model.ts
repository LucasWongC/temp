import {
  Table,
  Column,
  DataType,
  Model,
  AfterSave,
  BelongsTo,
  ForeignKey,
  HasMany,
} from 'sequelize-typescript'
import { storagePath, storageUrl } from '../helpers'
import textToSpeech from '../services/textToSpeech'
import Campaign from './Campaign.model'
import IVRPrompt from './IVRPrompt.model'

@Table({
  updatedAt: false,
})
class IVR extends Model<IVR> {
  @Column({
    allowNull: false,
  })
  name: string

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  transferMessage: string

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  removeMessage: string

  @Column({
    allowNull: false,
  })
  voice: string

  @Column({
    allowNull: false,
    defaultValue: 1,
  })
  speed: number

  @Column({
    allowNull: false,
    defaultValue: 2,
  })
  pauseTime: number

  @Column({
    allowNull: false,
    defaultValue: 3,
  })
  loopTime: number

  @Column({
    allowNull: false,
    defaultValue: 3,
  })
  loop: number

  @BelongsTo(() => Campaign, {
    onDelete: 'CASCADE',
  })
  Campaign: Campaign

  @ForeignKey(() => Campaign)
  @Column
  CampaignId: number

  @HasMany(() => IVRPrompt)
  IVRPrompts: IVRPrompt[]

  transferAudio() {
    return storageUrl(`ivrAudios/${this.id}-transfer.mp3`)
  }

  removeAudio() {
    return storageUrl(`ivrAudios/${this.id}-remove.mp3`)
  }

  @AfterSave
  static async generateAudios(ivr) {
    if (ivr.changed('voice') || ivr.changed('speed')) {
      const prompts = await ivr.getIVRPrompts()
      for (const prompt of prompts) {
        await prompt.generateAudio(ivr.voice, ivr.speed)
        await prompt.save()
      }
    }

    if (
      ivr.changed('transferMessage') ||
      ivr.changed('voice') ||
      ivr.changed('speed')
    ) {
      try {
        await textToSpeech(
          ivr.transferMessage,
          storagePath(`ivrAudios/${ivr.id}-transfer.mp3`),
          ivr.voice,
          ivr.speed
        )
      } catch (e) {
        console.log(e)
      }
    }

    if (
      ivr.changed('removeMessage') ||
      ivr.changed('voice') ||
      ivr.changed('speed')
    ) {
      try {
        await textToSpeech(
          ivr.removeMessage,
          storagePath(`ivrAudios/${ivr.id}-remove.mp3`),
          ivr.voice,
          ivr.speed
        )
      } catch (e) {
        console.log(e)
      }
    }
  }
}

export default IVR
