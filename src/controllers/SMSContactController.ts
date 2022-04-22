import { Op } from 'sequelize'
import { body as bodyCheck } from 'express-validator'

import { validator } from '../helpers/decorators'
import { getIdValidator } from '../helpers/validators'
import User, { UserRoles } from '../models/User.model'
import SMSContact from '../models/SMSContact.model'
import Lead from '../models/Lead.model'
import Message from '../models/Message.model'
import { CallStatus, CallResult } from '../models/CallLog.model'
import BlockList, { BlockType } from '../models/BlockList.model'
import FollowupGroup from '../models/FollowupGroup.model'
import FollowUp, { FollowupType } from '../models/FollowUp.model'

const idValidator = getIdValidator(SMSContact, 'id', 'id', 'smsContact')

export default class SMSContactController {
  static async index(req, res) {
    const { user, query } = req
    const where: any = { archived: 0 }
    const leadWhere: any = {
      blocked: false,
    }

    if (user.role !== UserRoles.ADMIN) {
      where.UserId = user.id
    } else {
      leadWhere.CampaignId = query.CampaignId || 0
    }
    if (query.updatedAt) {
      where.updatedAt = {
        [Op.lte]: query.updatedAt,
      }
    }

    const rows = await SMSContact.findAll({
      where,
      include: [
        {
          model: Lead,
          attributes: ['firstName', 'lastName', 'CampaignId'],
          required: true,
          where: leadWhere,
        },
        {
          model: User,
          attributes: ['id', 'firstName', 'lastName', 'email'],
        },
      ],
      order: [['updatedAt', 'DESC']],
      limit: 50,
    })

    res.json(rows)
  }

  @validator([idValidator, bodyCheck('UserId').exists()])
  static async update(req, res) {
    const { smsContact, body } = req

    await smsContact.update(
      { UserId: body.UserId || null },
      {
        silent: true,
      }
    )
    const user = await smsContact.getUser()

    res.json({
      ...smsContact.toJSON(),
      User: user,
    })
  }

  @validator([idValidator])
  static async clearUnread(req, res) {
    const { smsContact } = req

    await smsContact.update(
      { unreadCount: 0 },
      {
        silent: true,
      }
    )
    await Message.update(
      { unread: 0 },
      {
        where: { SMSContactId: smsContact.id },
      }
    )

    res.json({ success: true })
  }

  @validator([idValidator])
  static async closeContact(req, res) {
    const { smsContact } = req

    // archive contact
    await smsContact.update(
      { archived: true },
      {
        silent: true,
      }
    )

    // make the call log to completed
    const callLog = await smsContact.getCallLog()
    if (callLog) {
      await callLog.update({
        callStatus: CallStatus.COMPLETED,
        status: CallResult.REMOVED,
      })
    }

    res.json({ success: true })
  }

  @validator([idValidator])
  static async block(req, res) {
    const { smsContact } = req

    // archive contact
    await smsContact.update(
      { archived: true },
      {
        silent: true,
      }
    )

    // make the call log to completed
    const callLog = await smsContact.getCallLog()
    if (callLog) {
      await callLog.update({
        callStatus: CallStatus.COMPLETED,
        status: CallResult.REMOVED,
      })
    }

    const lead: Lead = await smsContact.getLead()

    // add block list
    await BlockList.create({
      type: BlockType.PHONE,
      content: lead.phone,
    })

    if (lead.email) {
      await BlockList.create({
        type: BlockType.EMAIL,
        content: lead.email,
      })
    }

    res.json({ success: true })
  }

  @validator([
    idValidator,
    getIdValidator(FollowupGroup, 'followupGroupId'),
    bodyCheck('time').exists(),
  ])
  static async schedule(req, res) {
    const { smsContact, followupGroup } = req
    const { time } = req.body

    const lead: Lead = await smsContact.getLead()

    // check campaign
    if (followupGroup.CampaignId !== lead.CampaignId) {
      return res
        .status(422)
        .json({ error: 'Campaign is different. Please check again' })
    }

    // check schedule exists
    const scheduleExist = await FollowUp.count({
      where: {
        type: FollowupType.SCHEDULE,
        FollowupGroupId: followupGroup.id,
      },
    })

    if (!scheduleExist) {
      return res.status(422).json({
        error: 'Scheduled call is not added. Please check the followup',
      })
    }

    await lead.createProgresses(followupGroup.id, true, time)

    res.json({ success: true })
  }
}
