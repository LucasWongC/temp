import fs from 'fs'
import randtoken from 'rand-token'
import twilio from 'twilio'
import { Op } from 'sequelize'
import {
  Table,
  Column,
  DataType,
  Model,
  BelongsTo,
  ForeignKey,
  BeforeSave,
  HasMany,
} from 'sequelize-typescript'

import config from '../config'
import { storageUrl, storagePath } from '../helpers'
import textToSpeech, { getGoogleSSML } from '../services/textToSpeech'
import IVR from './IVR.model'
import TransferOption from './TransferOption.model'
import IVRPromptMessage from './IVRPromptMessage.model'

export enum PromptTypes {
  PROMPT = 'Prompt',
  REMOVE = 'Remove',
  TRANSFER = 'Transfer',
  END_CALL = 'EndCall',
}

@Table({
  timestamps: false,
})
class IVRPrompt extends Model<IVRPrompt> {
  @Column({
    type: DataType.ENUM('Prompt', 'Remove', 'Transfer', 'EndCall'),
    defaultValue: PromptTypes.PROMPT,
  })
  type: PromptTypes

  @Column({
    type: DataType.STRING(50),
    defaultValue: '[0,0]',
  })
  get position() {
    const value: any = this.getDataValue('position')

    return value ? JSON.parse(value) : [0, 0]
  }
  set position(val) {
    this.setDataValue('position', JSON.stringify(val || [0, 0]))
  }

  @Column
  name: string

  @Column
  message: string

  @Column
  audio: string

  @Column({
    type: DataType.TEXT,
    defaultValue: '[]',
  })
  get buttons() {
    const value: any = this.getDataValue('buttons')

    return value ? JSON.parse(value) : []
  }
  set buttons(val) {
    this.setDataValue('buttons', JSON.stringify(val || []))
  }

  @Column({
    defaultValue: 0,
  })
  used: number

  @Column({
    defaultValue: false,
  })
  first: boolean

  // ivr
  @BelongsTo(() => IVR, {
    onDelete: 'CASCADE',
  })
  IVR: IVR

  @ForeignKey(() => IVR)
  @Column
  IVRId: number

  // transfer option
  @BelongsTo(() => TransferOption, {
    onDelete: 'SET NULL',
  })
  TransferOption: TransferOption

  @ForeignKey(() => TransferOption)
  @Column
  TransferOptionId: number

  // messages
  @HasMany(() => IVRPromptMessage)
  messages: IVRPromptMessage[]

  async getNextPrompt() {
    const nextOne = await IVRPrompt.findOne({
      where: {
        IVRId: this.IVRId,
        id: { [Op.gt]: this.id },
      },
      order: [['id', 'ASC']],
    })

    return nextOne
  }

  // pick a message by percent
  async pickMessage(): Promise<IVRPromptMessage> {
    const messages = (await this.$get('messages')) as IVRPromptMessage[]
    const pickedPercent = Math.random() * 100
    let percent = 0
    let message: IVRPromptMessage = null

    for (message of messages) {
      if (
        pickedPercent >= percent &&
        pickedPercent <= percent + message.percent
      ) {
        break
      }
      percent += message.percent
    }

    // increase the used
    if (message) {
      message.used += 1
      await message.save()
    }

    return message
  }

  async toTwilioResponse(isFirstCall = false) {
    const ivr: IVR = this.IVR || ((await this.$get('IVR')) as any)
    const response = new twilio.twiml.VoiceResponse()

    if (isFirstCall) {
      response.pause({ length: ivr.pauseTime })
    }

    // pick a message by percent
    const message = await this.pickMessage()

    let ivrObject: any = response
    if (this.buttons.length > 0) {
      // check if prompt has actions
      ivrObject = response.gather({
        action: `${config.API_URL}/twilio/ivr-prompts/${
          this.id
        }/gather?promptMessageId=${message ? message.id : 0}`,
        method: 'POST',
        numDigits: 1,
        timeout: 10,
      })
    }

    if (message) {
      for (let i = 0; i < ivr.loop; i += 1) {
        ivrObject.play(message.getAudioUrl())
        ivrObject.pause({ length: ivr.loopTime })
      }
    }

    return response.toString()
  }
}

export default IVRPrompt
