import express, { Router } from 'express'

import Controllers from '../controllers'
import jwt from '../services/jwt'
import { storagePath } from '../helpers'
import * as middlewares from './middlewares'
import { UserRoles } from '../models/User.model'

const router = Router()

router.use(jwt)

router.get('/test', Controllers.Test.index)
router.get('/test/mail', Controllers.Test.mail)
router.get('/test/twilio', Controllers.Test.twilio)
router.get('/test/user', Controllers.Test.user)
router.get('/test/insert-messages', Controllers.Test.insertPromptMessages)

// ------------- guest routes ----------------------
router.use(
  '/storage/ivrAudios',
  express.static(storagePath('ivrAudios'), {
    maxAge: '60m',
  })
)
router.use(
  '/storage/promptAudios',
  express.static(storagePath('promptAudios'), {
    maxAge: '2400h',
  })
)
router.use(
  '/storage/followupAudios',
  express.static(storagePath('followupAudios'), {
    maxAge: '2400h',
  })
)

router.post('/auth/login', Controllers.Auth.login)
router.post('/auth/forgot-password', Controllers.Auth.forgotPassword)
router.post('/auth/check-token', Controllers.Auth.checkToken)
router.post('/auth/reset-password', Controllers.Auth.resetPassword)

router.post('/users/email-exists', Controllers.User.emailExists)

router.post('/leads', Controllers.Lead.create)

router.post('/twilio/ivr-prompts/:promptId', Controllers.Twilio.playPrompt)
router.post(
  '/twilio/ivr-prompts/:promptId/gather',
  Controllers.Twilio.gatherPrompt
)

router.get('/twilio/call', Controllers.Twilio.call)
router.post('/twilio/status', Controllers.Twilio.status)
router.post('/twilio/status-sms', Controllers.Twilio.statusSMS)
router.post('/twilio/voice', Controllers.Twilio.voice)
router.post('/twilio/sms', Controllers.Twilio.sms)
router.use('/twilio/dial-callback', Controllers.Twilio.dialCallback)

// ------------- auth routes ------------------------
router.use(middlewares.authenticate())

router.use('/pusher/auth', Controllers.Pusher.auth)

router.get('/profile/info', Controllers.Profile.info)
router.get('/profile/message-count', Controllers.Profile.getMessageCount)
router.post('/profile/update', Controllers.Profile.update)

router.get('/sms-contacts/:id/messages', Controllers.Message.index)
router.post('/sms-contacts/:id/messages', Controllers.Message.send)

router.get('/sms-contacts', Controllers.SMSContact.index)
router.post(
  '/sms-contacts/:id/clear-unread',
  Controllers.SMSContact.clearUnread
)
router.post('/sms-contacts/:id/block', Controllers.SMSContact.block)
router.post('/sms-contacts/:id/schedule', Controllers.SMSContact.schedule)
router.put('/sms-contacts/:id', Controllers.SMSContact.update)
router.delete('/sms-contacts/:id', Controllers.SMSContact.closeContact)

router.get('/followup-groups/scheduled', Controllers.FollowupGroup.getSchedules)

// ---------- admin routes -------------
router.use(middlewares.authenticate([UserRoles.ADMIN]))

router.get('/users/agents', Controllers.User.getAgents)
router.post('/users', Controllers.User.create)
router.put('/users/:id', Controllers.User.update)
router.delete('/users/:id', Controllers.User.delete)

router.get('/twilio/numbers', Controllers.Twilio.getNumbers)

router.get('/campaigns', Controllers.Campaign.index)
router.post('/campaigns', Controllers.Campaign.create)
router.get('/campaigns/:id', Controllers.Campaign.show)
router.get('/campaigns/:id/message-count', Controllers.Campaign.getMessageCount)
router.put('/campaigns/:id', Controllers.Campaign.update)
router.delete('/campaigns/:id', Controllers.Campaign.delete)

router.get('/leads', Controllers.Lead.index)
router.get('/leads/charts', Controllers.Lead.charts)
router.get('/leads/:id', Controllers.Lead.show)
router.post('/leads/:id/interactions', Controllers.Lead.addInteraction)
router.post('/leads/:id/reset', Controllers.Lead.reset)
router.delete('/leads/:id', Controllers.Lead.delete)

router.get('/follow-ups', Controllers.FollowUp.index)
router.post('/follow-ups', Controllers.FollowUp.create)
router.get('/follow-ups/:id', Controllers.FollowUp.show)
router.put('/follow-ups/:id', Controllers.FollowUp.update)
router.delete('/follow-ups/:id', Controllers.FollowUp.delete)
router.post('/follow-ups/update-order', Controllers.FollowUp.updateOrder)

router.get('/ivr', Controllers.IVR.index)
router.post('/ivr', Controllers.IVR.create)
router.get('/ivr/:id', Controllers.IVR.show)
router.put('/ivr/:id', Controllers.IVR.update)
router.delete('/ivr/:id', Controllers.IVR.delete)

router.get('/ivr-prompts', Controllers.IVRPrompt.index)
router.post('/ivr-prompts', Controllers.IVRPrompt.create)
router.put('/ivr-prompts/:id', Controllers.IVRPrompt.update)
router.delete('/ivr-prompts/:id', Controllers.IVRPrompt.delete)

router.get('/numbers', Controllers.Number.index)
router.post('/numbers', Controllers.Number.create)
router.put('/numbers/:id', Controllers.Number.update)
router.delete('/numbers/:id', Controllers.Number.delete)

router.get('/transfer-options', Controllers.TransferOption.index)
router.post('/transfer-options', Controllers.TransferOption.create)
router.get('/transfer-options/:id', Controllers.TransferOption.show)
router.put('/transfer-options/:id', Controllers.TransferOption.update)
router.delete('/transfer-options/:id', Controllers.TransferOption.delete)

router.get('/transfer-numbers', Controllers.TransferNumber.index)
router.post('/transfer-numbers', Controllers.TransferNumber.create)
router.post(
  '/transfer-numbers/update-order',
  Controllers.TransferNumber.updateOrder
)
router.put('/transfer-numbers/:id', Controllers.TransferNumber.update)
router.delete('/transfer-numbers/:id', Controllers.TransferNumber.delete)

router.get('/call-logs', Controllers.CallLog.index)

router.get('/integrations', Controllers.Integration.index)
router.post('/integrations', Controllers.Integration.create)
router.get(
  '/integrations/transferable',
  Controllers.Integration.getTransferable
)
router.get('/integrations/:id', Controllers.Integration.show)
router.get('/integrations/:id/numbers', Controllers.Integration.getNumbers)
router.put('/integrations/:id', Controllers.Integration.update)
router.delete('/integrations/:id', Controllers.Integration.delete)
router.post('/integrations/test-api', Controllers.Integration.testApiKey)
router.post(
  '/integrations/ytel/agent-status',
  Controllers.Integration.ytelAgentStatus
)

router.get('/agents', Controllers.Agent.index)
router.post('/agents', Controllers.Agent.create)
router.get('/agents/:id', Controllers.Agent.show)
router.put('/agents/:id', Controllers.Agent.update)
router.delete('/agents/:id', Controllers.Agent.delete)

router.get('/followup-groups', Controllers.FollowupGroup.index)
router.post('/followup-groups', Controllers.FollowupGroup.create)
router.get('/followup-groups/:id', Controllers.FollowupGroup.show)
router.put('/followup-groups/:id', Controllers.FollowupGroup.update)
router.delete('/followup-groups/:id', Controllers.FollowupGroup.delete)

router.get('/transfers', Controllers.Transfer.index)
router.get('/transfers/charts', Controllers.Transfer.charts)

// block lists
router.get('/block-lists', Controllers.BlockList.index)
router.post('/block-lists', Controllers.BlockList.create)
router.put('/block-lists/:id', Controllers.BlockList.update)
router.delete('/block-lists/:id', Controllers.BlockList.delete)

export default router
