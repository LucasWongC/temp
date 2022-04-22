import { body as bodyCheck } from 'express-validator'
import sequelize, { Op } from 'sequelize'
import twilio from 'twilio'
import moment from 'moment'

import config from '../config'
import { validator } from '../helpers/decorators'
import { apiUrl, storageUrl, replaceParams } from '../helpers'
import { getIdValidator } from '../helpers/validators'

import client from '../services/twilio'
import { runSchedules } from '../services/cron'
import logger from '../services/logger'
import BlockList from '../models/BlockList.model'
import CallLog, {
  CallStatus,
  CallResult,
  CallType,
} from '../models/CallLog.model'
import PhoneNumber from '../models/PhoneNumber.model'
import IVRPrompt, { PromptTypes } from '../models/IVRPrompt.model'
import TransferOption from '../models/TransferOption.model'
import FollowupGroup, { FollowupGroupType } from '../models/FollowupGroup.model'
import Lead from '../models/Lead.model'
import FollowupProgress from '../models/FollowupProgress.model'
import FollowUp, { FollowupType } from '../models/FollowUp.model'
import SMSContact from '../models/SMSContact.model'
import User, { UserRoles } from '../models/User.model'
import Message from '../models/Message.model'
import IVRPromptMessage from '../models/IVRPromptMessage.model'

const accountValidator = bodyCheck('AccountSid')
  .exists()
  .custom(AccountSid => {
    if (AccountSid !== config.TWILIO_ACCOUNT_SID) {
      throw new Error('Invalid Account ID')
    }

    return true
  })
const callLogValidator = getIdValidator(CallLog, 'CallSid', 'sid')

export default class TwilioController {
  static async getNumbers(req, res) {
    const list = await client.incomingPhoneNumbers.list({ limit: 20 })
    const numbers = list.map(number => ({ phoneNumber: number.phoneNumber }))

    const existingNumbers = await PhoneNumber.findAll({
      attributes: ['number'],
    })

    res.json(
      numbers.filter(({ phoneNumber }) => {
        return !existingNumbers.find(item => item.number === phoneNumber)
      })
    )
  }

  @validator([
    accountValidator,
    callLogValidator,
    getIdValidator(IVRPrompt, 'promptId'),
  ])
  static async playPrompt(req, res) {
    const { callLog, iVRPrompt, body } = req

    if (body.AnsweredBy === 'machine_start' || body.AnsweredBy === 'fax') {
      const twiml = new twilio.twiml.VoiceResponse()
      twiml.hangup()

      res.send(twiml.toString())
    } else if (
      body.AnsweredBy === 'machine_end_beep' ||
      body.AnsweredBy === 'machine_end_silence' ||
      body.AnsweredBy === 'machine_end_other'
    ) {
      const followUp = await callLog.getFollowUp()
      const twiml = new twilio.twiml.VoiceResponse()

      twiml.play({}, storageUrl(followUp.mailAudio))

      res.send(twiml.toString())
    } else {
      // record the log

      iVRPrompt.used += 1
      await iVRPrompt.save()

      const twilioResponse = await iVRPrompt.toTwilioResponse(
        !!req.query.firstCall
      )
      res.send(twilioResponse)
    }
  }

  @validator([
    accountValidator,
    callLogValidator,
    bodyCheck('CallStatus').exists(),
  ])
  static async status(req, res) {
    const { body, callLog } = req

    if (body.CallStatus === CallStatus.INITIATED) {
      callLog.callStatus = body.CallStatus
      callLog.startTime = new Date(body.Timestamp)
    } else if (body.CallStatus === CallStatus.IN_PROGRESS) {
      callLog.callStatus = CallStatus.IN_PROGRESS
    } else {
      callLog.callStatus = body.CallStatus
      callLog.callDuration = body.CallDuration
      callLog.endTime = new Date(body.Timestamp)

      if (body.CallStatus === CallStatus.COMPLETED) {
        callLog.recordingUrl = body.RecordingUrl
      }

      if (
        callLog.status === CallResult.NOT_ANSWERED &&
        body.CallStatus === CallStatus.COMPLETED
      ) {
        callLog.status = CallResult.ANSWERED
      }

      if (body.AnsweredBy === 'machine_start' || body.AnsweredBy === 'fax') {
        callLog.status = CallResult.NOT_ANSWERED
        callLog.callStatus = CallStatus.MACHINE_ANSWERED
      } else if (
        body.AnsweredBy === 'machine_end_beep' ||
        body.AnsweredBy === 'machine_end_silence' ||
        body.AnsweredBy === 'machine_end_other'
      ) {
        callLog.status = CallResult.NOT_ANSWERED
        callLog.callStatus = CallStatus.LEFT_VOICEMAIL
        callLog.IVRId = null
      }
    }

    await callLog.save()

    res.json(callLog)
  }

  @validator([accountValidator, getIdValidator(CallLog, 'SmsSid', 'sid')])
  static async statusSMS(req, res) {
    const { body, callLog } = req

    callLog.callStatus = body.SmsStatus
    callLog.status =
      body.SmsStatus === 'sent' || body.SmsStatus === 'delivered'
        ? CallResult.ANSWERED
        : CallResult.NOT_ANSWERED

    await callLog.save()

    res.json(callLog)
  }

  /*
  save transfer duration time
  */
  @validator([accountValidator, callLogValidator])
  static async dialCallback(req, res) {
    const { body, callLog } = req

    if (body.DialCallDuration) {
      callLog.transferDuration = body.DialCallDuration
      callLog.transferEnd = moment(callLog.transferStart)
        .add(callLog.transferDuration, 'seconds')
        .toDate()
    } else {
      callLog.transferEnd = callLog.transferStart
    }

    await callLog.save()

    const twiml = new twilio.twiml.VoiceResponse()
    twiml.hangup()

    res.send(twiml.toString())
  }

  @validator([
    accountValidator,
    callLogValidator,
    getIdValidator(IVRPrompt, 'promptId'),
    getIdValidator(
      IVRPromptMessage,
      'promptMessageId',
      'id',
      'ivrPromptMessage'
    ),
  ])
  static async gatherPrompt(req, res) {
    const { body, callLog, iVRPrompt, ivrPromptMessage } = req

    const buttonPush = iVRPrompt.buttons[Number(body.Digits) - 1]
    const nextPrompt = buttonPush
      ? await IVRPrompt.findByPk(buttonPush.next)
      : null

    const response = new twilio.twiml.VoiceResponse()

    // repeate the prompt if no action is defined
    if (!nextPrompt) {
      response.redirect(apiUrl(`twilio/ivr-prompts/${iVRPrompt.id}`))
    } else if (nextPrompt.type === PromptTypes.PROMPT) {
      response.redirect(apiUrl(`twilio/ivr-prompts/${nextPrompt.id}`))
    } else if (nextPrompt.type === PromptTypes.REMOVE) {
      nextPrompt.used += 1
      await nextPrompt.save()

      // removed
      callLog.status = CallResult.REMOVED
      await callLog.save()

      response.play({}, storageUrl(`ivrAudios/${iVRPrompt.IVRId}-remove.mp3`))
    } else if (nextPrompt.type === PromptTypes.TRANSFER) {
      // get the lead
      const lead = await Lead.findByPk(callLog.LeadId)

      const transferNumber = await TransferOption.getAvailableNumber(
        nextPrompt.TransferOptionId,
        lead
      )

      // log transfer
      logger.info({ action: 'transfer', phone: transferNumber.phone })

      if (!transferNumber) {
        response.say('Sorry, there is not available number')
      } else {
        callLog.status = CallResult.TRANSFERRED
        callLog.TransferNumberId = transferNumber.id
        callLog.transferStart = new Date()

        await callLog.save()

        // ping optimize
        await transferNumber.ping(lead)

        response.play(
          {},
          storageUrl(`ivrAudios/${iVRPrompt.IVRId}-transfer.mp3`)
        )

        const dial = response.dial({
          action: apiUrl('twilio/dial-callback'),
          callerId: lead.phone,
        })
        dial.number(
          transferNumber.Agent
            ? transferNumber.Agent.phone
            : transferNumber.phone
        )
        // increase used count
        nextPrompt.used += 1
        await nextPrompt.save()
      }
    } else if (nextPrompt.type === PromptTypes.END_CALL) {
      // increase used count
      nextPrompt.used += 1
      await nextPrompt.save()

      // get a message
      const message = await nextPrompt.pickMessage()
      if (message) {
        response.play({}, message.getAudioUrl())
      }
      response.hangup()
    }

    // increase the conversions
    if (nextPrompt) {
      ivrPromptMessage.conversions += 1
      await ivrPromptMessage.save()
    }

    // increase button use count
    if (buttonPush) {
      const buttons = iVRPrompt.buttons
      buttons[Number(body.Digits) - 1].used += 1
      iVRPrompt.buttons = buttons
      await iVRPrompt.save()
    }

    res.send(response.toString())
  }

  static async call(req, res) {
    await runSchedules()
    res.json(true)
  }

  @validator([accountValidator])
  static async voice(req, res) {
    const { CallSid, FromState, To, From } = req.body

    // check if phone number exists
    const phonenumber = await PhoneNumber.findOne({
      where: { number: To },
    })

    if (!phonenumber) {
      res.status(422).json('Not registered number')
      return
    }

    // check if lead is blocked
    const isBlocked = await BlockList.isBlocked({ phone: From })
    if (isBlocked) {
      res.status(503).json('Lead is blocked')
      return
    }

    // check if lead does exist or not
    let lead = await Lead.findOne({
      where: {
        phone: { [Op.or]: [From, From.replace('+1', '')] },
      },
    })

    // get followup groups available
    const inboundFollowGroups = await FollowupGroup.findAll({
      where: { type: FollowupGroupType.INBOUND_CALL },
    })
    const followupGroup = inboundFollowGroups.find(
      item => !item.knownOnly || (lead && lead.CampaignId === item.CampaignId)
    )

    if (!followupGroup) {
      res.status(404).json('Not available follow up')
      return
    }

    if (!lead) {
      lead = await Lead.create({
        firstName: 'Unkown',
        lastName: 'Unknown',
        state: FromState,
        phone: From,
        CampaignId: followupGroup.CampaignId,
      })
    }

    // make a lead
    await lead.createProgresses(followupGroup.id, true)

    // find a first sequence
    const firstProgress = await FollowupProgress.findOne({
      where: { LeadId: lead.id, LeadInteractionId: lead.currentInteraction },
      include: [FollowUp],
      order: [['id', 'ASC']],
    })

    if (firstProgress.FollowUp.type !== FollowupType.ACTIVATE_VOICE) {
      res.status(404).json('Not found activate voice sequence')
      return
    }

    const prompt = await IVRPrompt.findOne({
      where: {
        IVRId: firstProgress.FollowUp.IVRId,
        first: true,
      },
    })

    if (!prompt) {
      logger.error({
        func: 'voice',
        error: {
          message: 'First prompt not found',
          IVRId: firstProgress.FollowUp.IVRId,
        },
      })

      const twiml = new twilio.twiml.VoiceResponse()
      twiml.say('Sorry, not found action')
      res.end(twiml.toString())
      return
    }

    // create the call log
    await CallLog.create({
      type: CallType.INBOUND_CALL,
      status: CallResult.ANSWERED,
      callStatus: CallStatus.IN_PROGRESS,
      CampaignId: followupGroup.CampaignId,
      LeadId: lead.id,
      IVRId: firstProgress.FollowUp.IVRId,
      FollowUpId: firstProgress.FollowUpId,
      FollowupProgressId: firstProgress.id,
      LeadInteractionId: lead.currentInteraction,
      PhoneNumberId: phonenumber.id,
      startTime: new Date(),
      sid: CallSid,
    })

    const twiml = new twilio.twiml.VoiceResponse()
    twiml.redirect(apiUrl(`twilio/ivr-prompts/${prompt.id}`))

    res.send(twiml.toString())
  }

  @validator([accountValidator])
  static async sms(req, res) {
    const { Body, MessageSid, FromState, To, From, FromCity } = req.body

    // check if phone number exists
    const phonenumber = await PhoneNumber.findOne({
      where: { number: To },
    })

    if (!phonenumber) {
      res.status(422).json('Not registered number')
      return
    }

    // check if lead is blocked
    const isBlocked = await BlockList.isBlocked({ phone: From })
    if (isBlocked) {
      res.status(503).json('Lead is blocked')
      return
    }

    // check if lead does exist or not
    let lead = await Lead.findOne({
      where: {
        phone: { [Op.or]: [From, From.replace('+1', '')] },
      },
    })

    // get followup groups available
    const inboundFollowGroups = await FollowupGroup.findAll({
      where: { type: FollowupGroupType.INBOUND_SMS },
    })
    const followupGroup = inboundFollowGroups.find(
      item => !item.knownOnly || (lead && lead.CampaignId === item.CampaignId)
    )

    if (!followupGroup) {
      res.status(404).json('Not available follow up')
      return
    }

    if (!lead) {
      lead = await Lead.create({
        firstName: 'Unkown',
        lastName: 'Unknown',
        state: FromState,
        city: FromCity,
        phone: From,
        CampaignId: followupGroup.CampaignId,
      })
    }

    // check if should start or continue
    let smsContact = await SMSContact.findOne({
      where: { LeadId: lead.id },
    })
    let firstProgress

    if (!smsContact || !smsContact.CallLogId) {
      // make a lead
      await lead.createProgresses(followupGroup.id, true)

      // find a first sequence
      firstProgress = await FollowupProgress.findOne({
        where: { LeadId: lead.id, LeadInteractionId: lead.currentInteraction },
        include: [FollowUp],
        order: [['id', 'ASC']],
      })

      if (firstProgress.FollowUp.type !== FollowupType.NEW_CHAT) {
        res.status(404).json('Not found new chat sequence')
        return
      }

      // create the call log
      try {
        const callLog = await CallLog.create({
          type: CallType.INBOUND_TEXT,
          status: CallResult.ANSWERED,
          callStatus: CallStatus.IN_PROGRESS,
          SMS: Body,
          CampaignId: followupGroup.CampaignId,
          LeadId: lead.id,
          IVRId: null,
          FollowUpId: firstProgress.FollowUpId,
          FollowupProgressId: firstProgress.id,
          LeadInteractionId: lead.currentInteraction,
          PhoneNumberId: phonenumber.id,
          startTime: new Date(),
          sid: MessageSid,
        })

        // pick agent randomly if chat assignment is 'Random Agent'
        let userAgent = null
        if (firstProgress.FollowUp.leaveVoiceMail) {
          userAgent = await User.findOne({
            where: { role: UserRoles.AGENT },
            order: [sequelize.fn('RAND')],
          })
        }

        // create or update sms contact
        if (!smsContact) {
          smsContact = await SMSContact.create({
            LeadId: lead.id,
            CallLogId: callLog.id,
            lastMessage: Body,
            UserId: userAgent ? userAgent.id : null,
          })
        } else {
          await smsContact.update({
            CallLogId: callLog.id,
            lastMessage: Body,
            UserId: userAgent ? userAgent.id : null,
            archived: false,
          })
        }
      } catch (e) {
        res.json(e)
        return
      }
    } else if (smsContact.archived) {
      await smsContact.update({
        archived: false,
      })
    }

    // insert message
    await Message.create({
      SMSContactId: smsContact.id,
      content: Body,
      sid: MessageSid,
    })

    const twiml = new twilio.twiml.MessagingResponse()
    if (firstProgress && firstProgress.FollowUp.mailText) {
      const replyContent = replaceParams(firstProgress.FollowUp.mailText, {
        firstName: lead.firstName,
        lastName: lead.lastName,
        senderPhone: phonenumber.number,
      })

      twiml.message(replyContent)

      // insert message
      await Message.create({
        SMSContactId: smsContact.id,
        content: replyContent,
        sent: true,
        unread: false,
        sid: MessageSid,
      })
    }

    res.writeHead(200, { 'Content-Type': 'text/xml' })
    res.end(twiml.toString())
  }
}
