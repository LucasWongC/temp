import objectPath from 'object-path'
import { Op } from 'sequelize'
import sumBy from 'lodash/sumBy'

import twilio from '../services/twilio'
import TransferOption from '../models/TransferOption.model'
import Lead, { LeadType } from '../models/Lead.model'
import FollowUp from '../models/FollowUp.model'
import FollowupProgress, {
  ProgressStatus,
} from '../models/FollowupProgress.model'
import IVRPrompt, { PromptTypes } from '../models/IVRPrompt.model'
import IVRPromptMessage from '../models/IVRPromptMessage.model'
import TransferNumber from '../models/TransferNumber.model'
import Integration from '../models/Integration.model'

export default class TestController {
  static async index(req, res) {
    const lead = await Lead.findByPk(39044)

    const transferNumber = await TransferNumber.findByPk(1, {
      include: [Integration],
    })

    const result = await transferNumber.ping(lead)

    res.json(result)
  }

  static async mail(req, res) {
    const { limit } = req.query
    const result = await twilio.messages.create({
      from: '+13212185465',
      to: '+14074465307',
      body: 'Hey can you give us a call back at 5125725300 to complete your Medicare enrollment request?'.substr(
        0,
        limit || 1000
      ),
    })

    res.json(result)
  }

  static async user(req, res) {
    const lead = await Lead.findByPk(4)
    const transferNumber = await TransferOption.getAvailableNumber(1, lead)

    res.json(transferNumber)
  }

  static async twilio(req, res) {
    const nextProgress = await FollowupProgress.findByPk(2, {
      include: [
        {
          model: FollowUp,
        },
      ],
    })
    if (nextProgress) {
      const estimatedTime = nextProgress.FollowUp.getTime()

      await nextProgress.update({
        estimatedTime: nextProgress.FollowUp.Campaign.getEstimatedTime(
          estimatedTime
        ),
        progress: ProgressStatus.NEXT,
      })
    }

    res.json(nextProgress)
  }

  static async updateLeads(req, res) {
    const leads = await Lead.findAll()
    for (const lead of leads) {
      const phone = await twilio.lookups
        .phoneNumbers(lead.phone)
        .fetch({ type: ['carrier'] })

      lead.type =
        objectPath.get(phone, 'carrier.type') === 'mobile'
          ? LeadType.MOBILE
          : LeadType.LANDLINE
      await lead.save()
    }
    res.json({ success: true })
  }

  static async insertPromptMessages(req, res) {
    const prompts = await IVRPrompt.findAll({
      where: {
        type: {
          [Op.in]: [PromptTypes.PROMPT, PromptTypes.END_CALL],
        },
      },
    })

    const data = prompts.map(prompt => ({
      content: prompt.message || 'Empty message',
      audio: prompt.audio,
      percent: 100,
      used: prompt.used,
      conversions: sumBy(prompt.buttons, 'used'),
      IVRPromptId: prompt.id,
      IVRId: prompt.IVRId,
    }))

    await IVRPromptMessage.bulkCreate(data)

    res.json({ success: true })
  }
}
