import fs from 'fs'
import randtoken from 'rand-token'
import {
  Table,
  Column,
  Model,
  BelongsTo,
  ForeignKey,
  DataType,
  BeforeSave,
  AfterCreate,
} from 'sequelize-typescript'

import { storageUrl, storagePath } from '../helpers'
import textToSpeech, { getGoogleSSML } from '../services/textToSpeech'
import IVRPrompt from './IVRPrompt.model'
import IVR from './IVR.model'

@Table({
  timestamps: false,
})
class IVRPromptMessage extends Model<IVRPromptMessage> {
  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  content: string

  @Column({
    allowNull: false,
    defaultValue: 100,
  })
  percent: number

  @Column
  audio: string

  @Column({
    defaultValue: 0,
  })
  used: number

  @Column({
    defaultValue: 0,
  })
  conversions: number

  // ivr
  @BelongsTo(() => IVR, {
    onDelete: 'CASCADE',
  })
  IVR: IVR

  @ForeignKey(() => IVR)
  @Column
  IVRId: number

  // prompt
  @BelongsTo(() => IVRPrompt, {
    onDelete: 'CASCADE',
  })
  IVRPrompt: IVRPrompt

  @ForeignKey(() => IVRPrompt)
  @Column
  IVRPromptId: number

  getAudioUrl() {
    return storageUrl(`promptAudios/${this.audio}`)
  }

  async generateAudio(voice, speed) {
    // remove the old audio
    if (this.audio) {
      try {
        fs.unlinkSync(storagePath(`promptAudios/${this.audio}`))
      } catch {}
    }

    // create a new audio
    try {
      this.audio = `${randtoken.generate(30)}.mp3`
      await textToSpeech(
        getGoogleSSML(this.content),
        storagePath(`promptAudios/${this.audio}`),
        voice,
        speed
      )
    } catch (e) {
      this.audio = null
    }
  }

  @BeforeSave
  static async generateAudio(promptMessage) {
    if (promptMessage.changed('content') || !promptMessage.audio) {
      const ivr = await promptMessage.getIVR()
      await promptMessage.generateAudio(ivr.voice, ivr.speed)
    }
  }
}

export default IVRPromptMessage
