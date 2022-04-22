import { body as bodyCheck, check } from 'express-validator'

import client from '../services/twilio'
import { replaceParams } from '../helpers'
import { validator } from '../helpers/decorators'
import { getIdValidator } from '../helpers/validators'
import logger from '../services/logger'
import SMSContact from '../models/SMSContact.model'
import Message from '../models/Message.model'
import CallLog from '../models/CallLog.model'
import PhoneNumber from '../models/PhoneNumber.model'
import Lead from '../models/Lead.model'

const idValidator = getIdValidator(SMSContact)

export default class MessageController {
  @validator([idValidator])
  static async index(req, res) {
    const { sMSContact } = req

    const rows = await Message.findAll({
      where: { SMSContactId: sMSContact.id },
      order: [['id', 'asc']],
    })

    res.json(rows)
  }

  @validator([check('id').exists(), bodyCheck('content').exists()])
  static async send(req, res) {
    const { body, params } = req
    const smsContact = await SMSContact.findByPk(params.id, {
      include: [
        {
          model: CallLog,
          include: [PhoneNumber],
        },
        Lead,
      ],
    })

    if (!smsContact) {
      res.status(404).json('contact not found')
      return
    }

    try {
      const smsContent = replaceParams(body.content, {
        firstName: smsContact.Lead.firstName,
        lastName: smsContact.Lead.lastName,
        senderPhone: smsContact.CallLog.PhoneNumber.number,
      })

      const { sid } = await client.messages.create({
        from: smsContact.CallLog.PhoneNumber.number,
        to: smsContact.Lead.phone,
        body: smsContent,
      })

      const message = await Message.create({
        SMSContactId: smsContact.id,
        content: smsContent,
        sent: true,
        unread: false,
        sid,
      })

      res.json(message)
    } catch (error) {
      logger.error({
        func: 'send message',
        from: smsContact.CallLog.PhoneNumber.number,
        to: smsContact.Lead.phone,
        error: error.message,
      })
      res.status(500).json({ error })
    }
  }
}
