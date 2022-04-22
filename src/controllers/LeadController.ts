import { body as bodyCheck } from 'express-validator'
import moment from 'moment-timezone'
import groupBy from 'lodash/groupBy'
import sequelize from 'sequelize'

import config from '../config'
import { getIdValidator } from '../helpers/validators'
import { validator } from '../helpers/decorators'
import States from '../helpers/states'
import { runSchedules } from '../services/cron'

import logger from '../services/logger'
import Lead, { LeadStatus } from '../models/Lead.model'
import FollowUp from '../models/FollowUp.model'
import CallLog, { CallResult } from '../models/CallLog.model'
import FollowupProgress, {
  ProgressStatus,
} from '../models/FollowupProgress.model'
import TransferNumber from '../models/TransferNumber.model'
import Agent from '../models/Agent.model'
import FollowupGroup from '../models/FollowupGroup.model'
import ZipCode from '../models/ZipCode.model'
import Campaign from '../models/Campaign.model'
import BlockList from '../models/BlockList.model'

const idValidator = getIdValidator(Lead)

export default class LeadController {
  /*
  get
  */
  static async index(req, res) {
    const PAGE_SIZE = 30
    const { query } = req
    const page = query.page ? Number(query.page) : 0

    const leadConditions = [
      'Leads.CampaignId = :CampaignId',
      'Leads.blocked = 0',
    ]
    if (query.query) {
      leadConditions.push(
        `(Leads.phone LIKE :query OR CONCAT(Leads.firstName, ' ', Leads.lastName) LIKE :query)`
      )
    }
    if (query.startDate) {
      leadConditions.push(
        `Leads.createdAt >= '${moment
          .tz(query.startDate, config.TIME_ZONE)
          .startOf('day')
          .utc()
          .format('YYYY-MM-DD HH:mm:ss')}'`
      )
    }

    if (query.endDate) {
      leadConditions.push(
        `Leads.createdAt <= '${moment
          .tz(query.endDate, config.TIME_ZONE)
          .endOf('day')
          .utc()
          .format('YYYY-MM-DD HH:mm:ss')}'`
      )
    }

    const replacements = {
      query: `%${query.query}%`,
      CampaignId: query.CampaignId || 0,
      offset: page * PAGE_SIZE,
      limit: PAGE_SIZE,
    }

    const sql = `
      SELECT Leads.id, Leads.firstName, Leads.lastName, Leads.phone, Leads.status, Leads.CampaignId, Leads.createdAt,
        COUNT(CallLogs.id) AS attempts,
        MAX(CallLogs.startTime) AS lastFollowup
      FROM Leads
      LEFT JOIN CallLogs ON CallLogs.LeadId = Leads.id AND CallLogs.LeadInteractionId = Leads.currentInteraction
      WHERE ${leadConditions.join(' AND ')}
      GROUP BY Leads.id
      ORDER BY Leads.id DESC
      LIMIT :limit
      OFFSET :offset
    `

    const [{ count }] = await Lead.sequelize.query(
      `
        SELECT COUNT(id) AS count
        FROM Leads
        WHERE ${leadConditions.join(' AND ')}
      `,
      {
        replacements,
        type: sequelize.QueryTypes.SELECT,
      }
    )

    const rows = await Lead.sequelize.query(sql, {
      replacements,
      type: sequelize.QueryTypes.SELECT,
    })

    res.json({
      page,
      pageSize: PAGE_SIZE,
      pageCount: Math.ceil(count / PAGE_SIZE),
      rows,
    })
  }

  // create
  @validator([
    bodyCheck('firstName').exists(),
    bodyCheck('lastName').exists(),
    bodyCheck('phone')
      .exists()
      .isLength({ min: 7 }),
    bodyCheck('zipCode')
      .exists()
      .isLength({ min: 3, max: 5 }),
    bodyCheck('age')
      .exists()
      .isInt({ gt: 18 }),
    bodyCheck('optimizeID').optional(),
    getIdValidator(Campaign, 'token', 'token'),
    getIdValidator(FollowupGroup, 'followupId'),
  ])
  static async create(req, res) {
    const { body, campaign, followupGroup } = req

    if (!campaign.active) {
      res.status(503).json({
        errors: {
          campaign: 'Campaign is not active',
        },
      })
      return
    }

    // check if lead is blocked
    const isBlocked = await BlockList.isBlocked(body)
    if (isBlocked) {
      res.status(504).json('Lead is blocked')
      return
    }

    // find the zipCode
    const zipCode = await ZipCode.findByCode(body.zipCode.padStart(5, '0')) // make 615 to 00615

    if (!zipCode) {
      res.status(422).json({ zipCode: 'Invalid zipcode' })
      return
    }

    // find the state
    const state = States.find(item => item.abbreviation === zipCode.state)

    // create the lead
    const lead = await Lead.create({
      ...body,
      city: zipCode.city,
      state: zipCode.state,
      location: zipCode.location,
      timezone: state ? state.timezone : null,
      CampaignId: campaign.id,
    })

    // create progresses
    try {
      await lead.createProgresses(followupGroup.id)
    } catch {
      res.status(422).json({ FollowupGroupId: 'No sequences' })
      return
    }

    // run the cron job immediately
    await runSchedules()

    res.json(lead)
  }

  static async getLeadDetail(lead) {
    const progresses = await FollowupProgress.findAll({
      where: { LeadId: lead.id },
      include: [
        {
          model: FollowUp,
          attributes: ['type', 'FollowupGroupId'],
        },
        {
          model: CallLog,
          attributes: ['callStatus', 'status', 'startTime', 'endTime'],
          include: [
            {
              model: TransferNumber,
              attributes: ['AgentId', 'phone'],
              include: [
                {
                  model: Agent,
                  attributes: ['phone'],
                },
              ],
            },
          ],
        },
      ],
      order: [['LeadInteractionId', 'asc'], ['step', 'asc']],
    })

    const groupedProgresses: any = Object.values(
      groupBy(progresses, 'LeadInteractionId')
    )
    const FollowupGroups = []

    let index = 0
    for (const sequences of groupedProgresses) {
      if (!sequences[0].FollowUp) {
        continue
      }

      let followupGroup: any = await FollowupGroup.findByPk(
        sequences[0].FollowUp.FollowupGroupId
      )
      followupGroup = followupGroup.toJSON()
      followupGroup.id = index
      index += 1

      const nextSequence = (followupGroup.status = sequences.find(
        item => item.progress === ProgressStatus.NEXT
      ))
      followupGroup.status = nextSequence ? 'In Process' : 'Complete'

      const waitingSequence = sequences.find(
        item => item.progress !== ProgressStatus.COMPLETE
      )
      followupGroup.lastSequence = waitingSequence
        ? waitingSequence.step
        : sequences.length

      followupGroup.startDate = sequences[0].createdAt
      followupGroup.sequences = sequences

      followupGroup.finalOutcome = 'No Contact'
      for (const sequence of sequences) {
        if (!sequence.CallLog) {
          continue
        }
        if (
          sequence.CallLog.status === CallResult.TRANSFERRED ||
          sequence.CallLog.status === CallResult.REMOVED
        ) {
          followupGroup.finalOutcome = sequence.CallLog.status
          break
        } else if (sequence.CallLog.status === CallResult.ANSWERED) {
          followupGroup.finalOutcome = 'Contacted'
        }
      }

      FollowupGroups.push(followupGroup)
    }

    return {
      ...lead.toJSON(),
      FollowupGroups,
    }
  }

  @validator([idValidator])
  static async show(req, res) {
    const { lead } = req
    const detail = await LeadController.getLeadDetail(lead)

    res.json(detail)
  }

  /* delete */
  @validator([idValidator])
  static async delete(req, res) {
    const { lead } = req

    // destroy all old progresses
    await FollowupProgress.destroy({
      where: { LeadID: lead.id },
    })

    // clear call logs
    await CallLog.destroy({
      where: { LeadID: lead.id },
    })

    await lead.destroy()
    res.json('success')
  }

  // create
  @validator([idValidator, getIdValidator(FollowupGroup, 'followupId')])
  static async addInteraction(req, res) {
    const { lead, followupGroup } = req

    // create progresses
    try {
      await lead.createProgresses(followupGroup.id)

      const detail = await LeadController.getLeadDetail(lead)

      await runSchedules()

      res.json(detail)
    } catch (error) {
      res.status(422).json({ FollowupGroupId: 'No sequences' })
    }
  }

  @validator([idValidator])
  static async reset(req, res) {
    const { lead } = req

    // pick last interaction
    const progress = await FollowupProgress.findOne({
      where: { LeadID: lead.id },
      include: [FollowUp],
      order: [['LeadInteractionId', 'DESC']],
    })

    try {
      await lead.createProgresses(progress.FollowUp.FollowupGroupId)

      const detail = await LeadController.getLeadDetail(lead)
      res.json(detail)

      await runSchedules()
    } catch (error) {
      logger.error({ func: 'rest', error: error.message })
      res.status(422).json({ FollowupGroupId: 'No sequences' })
    }
  }

  /*
  get
  */
  static async charts(req, res) {
    const LAST_DAYS = 30
    const { query } = req

    const summaryCondition = [
      'Leads.CampaignId = :CampaignId',
      'Leads.blocked = 0',
    ]
    if (query.startDate) {
      summaryCondition.push(
        `Leads.createdAt >= '${moment
          .tz(query.startDate, config.TIME_ZONE)
          .startOf('day')
          .utc()
          .format('YYYY-MM-DD HH:mm:ss')}'`
      )
    }

    if (query.endDate) {
      summaryCondition.push(
        `Leads.createdAt <= '${moment
          .tz(query.endDate, config.TIME_ZONE)
          .endOf('day')
          .utc()
          .format('YYYY-MM-DD HH:mm:ss')}'`
      )
    }

    const [summary] = await Lead.sequelize.query(
      `
        SELECT
          COUNT(Leads.id) AS leads,
          SUM(IF(Leads.status <> '${
            LeadStatus.NOT_CALLED
          }', 1, 0)) AS contacted,
          SUM(IF(Leads.status = '${
            LeadStatus.TRANSFERRED
          }', 1, 0)) AS transferred,
          SUM(IF(Leads.status = '${LeadStatus.REMOVED}', 1, 0)) AS removed
        FROM Leads
        WHERE ${summaryCondition.join(' AND ')}
      `,
      {
        replacements: {
          CampaignId: query.CampaignId || 0,
        },
        type: sequelize.QueryTypes.SELECT,
      }
    )

    // make graph data
    const chartFormat =
      query.startDate && query.startDate === query.endDate ? 'hourly' : 'daily'

    const chartCondition = ['Leads.CampaignId = :CampaignId']

    if (chartFormat === 'daily') {
      chartCondition.push(
        `Leads.createdAt >= '${moment
          .tz(
            moment()
              .subtract(LAST_DAYS, 'days')
              .format('YYYY-MM-DD'),
            config.TIME_ZONE
          )
          .startOf('day')
          .utc()
          .format('YYYY-MM-DD HH:mm:ss')}'`
      )

      chartCondition.push(
        `Leads.createdAt <= '${moment
          .tz(moment().format('YYYY-MM-DD'), config.TIME_ZONE)
          .endOf('day')
          .utc()
          .format('YYYY-MM-DD HH:mm:ss')}'`
      )
    } else {
      chartCondition.push(
        `Leads.createdAt >= '${moment
          .tz(query.startDate, config.TIME_ZONE)
          .startOf('day')
          .utc()
          .format('YYYY-MM-DD HH:mm:ss')}'`
      )
      chartCondition.push(
        `Leads.createdAt <= '${moment
          .tz(query.startDate, config.TIME_ZONE)
          .endOf('day')
          .utc()
          .format('YYYY-MM-DD HH:mm:ss')}'`
      )
    }

    const dateColumn =
      chartFormat === 'hourly'
        ? `DATE_FORMAT(CONVERT_TZ(createdAt, '+00:00', '${moment
            .tz(config.TIME_ZONE)
            .format('Z')}'), '%H')`
        : `DATE(CONVERT_TZ(createdAt, '+00:00', '${moment
            .tz(config.TIME_ZONE)
            .format('Z')}'))`

    const charts = await Lead.sequelize.query(
      `
        SELECT
          ${dateColumn} AS date,
          COUNT(Leads.id) AS leads,
          SUM(IF(Leads.status <> '${
            LeadStatus.NOT_CALLED
          }' AND Leads.status <> '${LeadStatus.CALLED}', 1, 0)) AS contacted,
          SUM(IF(Leads.status = '${
            LeadStatus.TRANSFERRED
          }', 1, 0)) AS transferred,
          SUM(IF(Leads.status = '${LeadStatus.REMOVED}', 1, 0)) AS removed
        FROM Leads
        WHERE ${chartCondition.join(' AND ')}
        GROUP BY date
      `,
      {
        replacements: {
          CampaignId: query.CampaignId || 0,
        },
        type: sequelize.QueryTypes.SELECT,
      }
    )

    res.json({
      chartFormat,
      charts,
      summary,
    })
  }
}
