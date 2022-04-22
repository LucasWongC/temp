import Cron from 'cron'
import sequelize, { Op } from 'sequelize'

import { apiUrl, replaceParams } from '../helpers'
import logger from './logger'
import client from './twilio'
import Ytel from './ytel'
import FollowupProgress, {
  ProgressStatus,
} from '../models/FollowupProgress.model'
import Lead from '../models/Lead.model'
import Campaign from '../models/Campaign.model'
import FollowUp, { FollowupType } from '../models/FollowUp.model'
import PhoneNumber from '../models/PhoneNumber.model'
import CallLog, { CallType } from '../models/CallLog.model'
import IVRPrompt from '../models/IVRPrompt.model'
import Integration, { IntegrationPartners } from '../models/Integration.model'
import { CallEvents } from '../models/CallLog.model'
import SMSContact from '../models/SMSContact.model'
import Message from '../models/Message.model'

let isCronRunning = false

export async function runSchedules() {
  if (isCronRunning) {
    return
  }

  // mark the task as running
  isCronRunning = true

  const progresses = await FollowupProgress.findAll({
    where: {
      progress: ProgressStatus.NEXT,
      estimatedTime: { [Op.lte]: sequelize.fn('NOW') },
    },
    include: [
      {
        model: Lead,
        include: [
          {
            model: Campaign,
            attributes: ['id', 'active'],
            where: { active: true },
            required: true,
          },
        ],
        required: true,
      },
      {
        model: FollowUp,
      },
    ],
  })

  for (const progress of progresses) {
    const number = await PhoneNumber.getAvailableOne(progress.Lead.CampaignId)
    if (!number) {
      logger.info('Number not available')
      break
    }

    try {
      // update the followupprogress
      await progress.update({ progress: ProgressStatus.COMPLETE })

      if (progress.FollowUp.type === FollowupType.SEND_SMS) {
        const smsText = replaceParams(progress.FollowUp.mailText, {
          firstName: progress.Lead.firstName,
          lastName: progress.Lead.lastName,
          senderPhone: number.number,
        })
        const { sid, status } = await client.messages.create({
          from: number.number,
          to: progress.Lead.phone,
          body: smsText,
          statusCallback: apiUrl('twilio/status-sms'),
        })

        // create the call log
        await CallLog.create({
          type: CallType.OUTBOUND_TEXT,
          callStatus: status,
          CampaignId: progress.Lead.CampaignId,
          LeadId: progress.LeadId,
          IVRId: null,
          FollowUpId: progress.FollowUpId,
          FollowupProgressId: progress.id,
          LeadInteractionId: progress.LeadInteractionId,
          PhoneNumberId: number.id,
          startTime: new Date(),
          sid,
        })

        // check if should start or continue
        let smsContact = await SMSContact.findOne({
          where: { LeadId: progress.Lead.id },
        })
        if (!smsContact) {
          // create sms contact
          smsContact = await SMSContact.create({
            LeadId: progress.Lead.id,
            lastMessage: smsText,
            archived: true,
          })
        }
        // insert message
        await Message.create({
          SMSContactId: smsContact.id,
          content: smsText,
          sid,
          sent: true,
          unread: false,
        })
      } else if (
        progress.FollowUp.type === FollowupType.CALL ||
        progress.FollowUp.type === FollowupType.SCHEDULE
      ) {
        const prompt = await IVRPrompt.findOne({
          where: {
            IVRId: progress.FollowUp.IVRId,
            first: true,
          },
        })

        if (!prompt) {
          logger.info('The IVR has no prompts')
          continue
        }

        const { sid } = await client.calls.create({
          machineDetection: progress.FollowUp.leaveVoiceMail
            ? 'DetectMessageEnd'
            : 'Enable',
          MachineDetectionTimeout: 3,
          record: true,
          url: apiUrl(`twilio/ivr-prompts/${prompt.id}?firstCall=1`),
          to: progress.Lead.phone,
          from: number.number,
          statusCallback: apiUrl(`twilio/status`),
          statusCallbackMethod: 'POST',
          statusCallbackEvent: [
            CallEvents.INITIATED,
            CallEvents.ANSWERED,
            CallEvents.COMPLETED,
          ],
        })

        // create the call log
        await CallLog.create({
          type: CallType.OUTBOUND_CALL,
          CampaignId: progress.Lead.CampaignId,
          LeadId: progress.LeadId,
          IVRId: prompt.IVRId,
          FollowUpId: progress.FollowUpId,
          FollowupProgressId: progress.id,
          LeadInteractionId: progress.LeadInteractionId,
          PhoneNumberId: number.id,
          startTime: new Date(),
          sid,
        })
      } else if (progress.FollowUp.type === FollowupType.SEND_YTEL) {
        const ytelIntegration = await Integration.findOne({
          where: { partner: IntegrationPartners.YTEL },
        })

        if (!ytelIntegration) {
          logger.info({ func: 'cron', info: 'ytel integration not exists' })
          continue
        }

        const ytel = new Ytel(
          ytelIntegration.accountName,
          ytelIntegration.apiKey
        )

        await ytel.addLead({
          first_name: progress.Lead.firstName,
          last_name: progress.Lead.lastName,
          city: progress.Lead.city,
          state: progress.Lead.state,
          zip_code: progress.Lead.zipCode,
          phone_number: progress.Lead.phone,
          age: progress.Lead.age,
          list_id: progress.FollowUp.mailText,
        })

        await progress.scheduleNext()
      }
    } catch (error) {
      console.log({ func: 'cron', error: error.message })
      await progress.scheduleNext()
    }
  }

  if (progresses.length) {
    console.log(`${progresses.length} followup progresses scheduled`)
  }

  // mark task as completed
  isCronRunning = false
}

export function run() {
  // run every minute
  const cron = new Cron.CronJob(
    '* * * * * *',
    runSchedules,
    null,
    false,
    'America/Los_Angeles',
    null,
    true
  )

  cron.start()
}
