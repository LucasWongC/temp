import {
  Table,
  Column,
  DataType,
  Model,
  BelongsTo,
  ForeignKey,
  AfterCreate,
} from 'sequelize-typescript'

import pusher from '../services/pusher'
import SMSContact from './SMSContact.model'
import Lead from './Lead.model'

@Table({
  updatedAt: false,
})
class Message extends Model<Message> {
  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  content: string

  @Column({
    defaultValue: false,
  })
  sent: boolean

  @Column({
    defaultValue: true,
  })
  unread: boolean

  @Column
  sid: string

  @BelongsTo(() => SMSContact, {
    onDelete: 'CASCADE',
  })
  SMSContact: SMSContact

  @ForeignKey(() => SMSContact)
  @Column
  SMSContactId: number

  @AfterCreate
  static async notifyMessage(message) {
    const smsContact = await message.getSMSContact({
      include: [
        {
          model: Lead,
          attributes: ['firstName', 'lastName', 'CampaignId'],
        },
      ],
    })

    if (message.unread) {
      smsContact.unreadCount += 1
    }
    smsContact.lastMessage = message.content

    await smsContact.save()

    if (message.unread) {
      const channels = ['private-admin']
      if (smsContact.UserId) {
        channels.push(`private-user${smsContact.UserId}`)
      }

      pusher.trigger(channels, 'message', {
        ...message.toJSON(),
        SMSContact: smsContact,
      })
    }
  }
}

export default Message
